/**
 * Test Suite: Sécurité des Jetons du Portail Client & Liste Blanche de Données
 * 
 * 1) Génération serveur avec crypto.randomBytes(32) en base64url (43 caractères URL-safe, 256 bits).
 * 2) Route protégée exigeant authentification et vérification du propriétaire du projet (ownerId === req.user.uid).
 * 3) Régénération invalidant immédiatement l'ancien jeton.
 * 4) Unicité vérifiée.
 * 5) getClientPortalDataByToken : liste blanche stricte pour devis et factures (aucun ownerId, workspaceId ni note interne).
 * 6) Champ delivery exclu tant que le solde n'est pas réglé.
 * 7) clientShareToken jamais renvoyé au client dans safeProject.
 * 8) Messages d'erreur génériques.
 */

import http from 'http';
import assert from 'assert';
import { app } from '../server.js';
import { 
  registerMockPortalProject,
  getMockPortalProject,
  registerMockPortalQuote,
  registerMockPortalInvoice,
  clearMockPortalData,
  getClientPortalDataByToken,
  generateSecurePortalTokenForProject,
  revokePortalTokenForProject,
  setPortalLinkStatusForProject,
  sanitizePortalQuote,
  sanitizePortalInvoice
} from '../src/server/firebaseAdminSdk.js';

let testServer: http.Server;
let baseUrl: string;

function makeRequest(method: string, path: string, body?: any, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders: Record<string, string> = { ...headers };
    let postData = '';

    if (body !== undefined) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders
      },
      (res) => {
        let resData = '';
        res.on('data', chunk => { resData += chunk; });
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(resData);
          } catch {
            parsed = resData;
          }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('======================================================');
  console.log('🛡️ TESTS SÉCURITÉ PORTAIL CLIENT : JETONS & LISTE BLANCHE');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      const res = fn();
      if (res && typeof (res as any).then === 'function') {
        return (res as any).then(() => {
          console.log(`  ✓ [PASS] ${name}`);
          passed++;
        }).catch((err: any) => {
          console.error(`  ✗ [FAIL] ${name}:`, err.message);
          throw err;
        });
      } else {
        console.log(`  ✓ [PASS] ${name}`);
        passed++;
      }
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // Démarrage du serveur de test sur un port dynamique
  await new Promise<void>((resolve) => {
    testServer = http.createServer(app).listen(0, '127.0.0.1', () => {
      const addr = testServer.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  try {
    clearMockPortalData();

    const ownerUid = 'usr_owner_secure_456';
    const attackerUid = 'usr_attacker_789';

    console.log('1. Tests Sécurité de la Route de Génération (/api/projects/:id/portal-token) :');

    const testProject = {
      id: 'proj_sec_100',
      ownerId: ownerUid,
      title: 'Projet Identité Graphique Test',
      budget: 1500,
      paidAmount: 500,
      clientShareToken: '',
      clientLinkActive: false,
      delivery: {
        isUnlocked: false,
        files: ['logo_final.svg', 'charte.pdf']
      }
    };
    registerMockPortalProject(testProject);

    await test('Refuse la génération de jeton si non authentifié (401)', async () => {
      const res = await makeRequest('POST', `/api/projects/${testProject.id}/portal-token`);
      assert.strictEqual(res.status, 401, 'Doit refuser 401 sans token d\'authentification');
    });

    await test('Refuse la génération si jeton invalide ou inventé (401)', async () => {
      const res = await makeRequest('POST', `/api/projects/${testProject.id}/portal-token`, {}, {
        'Authorization': 'Bearer fake_invalid_jwt_token'
      });
      assert.strictEqual(res.status, 401, 'Doit renvoyer 401 sur jeton invalide');
    });

    console.log('\n2. Tests Logique Métier Génération de Jeton & Propriétaire :');

    await test('Refuse la génération si l\'utilisateur n\'est pas le propriétaire du projet (FORBIDDEN)', async () => {
      const res = await generateSecurePortalTokenForProject(testProject.id, attackerUid);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'FORBIDDEN');
    });

    await test('Refuse la génération pour un projet inexistant (PROJECT_NOT_FOUND)', async () => {
      const res = await generateSecurePortalTokenForProject('proj_inexistant_999', ownerUid);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'PROJECT_NOT_FOUND');
    });

    let generatedToken1 = '';
    await test('Génère un jeton sécurisé de 256 bits avec crypto.randomBytes(32) en base64url pour le propriétaire', async () => {
      const res = await generateSecurePortalTokenForProject(testProject.id, ownerUid);
      assert.strictEqual(res.success, true);
      assert.ok(res.token, 'Un jeton doit être retourné');
      generatedToken1 = res.token!;

      // 32 octets encodés en base64url font exactement 43 caractères
      assert.strictEqual(generatedToken1.length, 43, 'Le jeton doit mesurer 43 caractères (32 bytes base64url)');
      // Caractères conformes URL-safe uniquement (pas de +, /, =)
      assert.match(generatedToken1, /^[A-Za-z0-9_-]{43}$/, 'Le jeton doit respecter le format base64url strict');
    });

    await test('Le nouveau jeton permet d\'accéder aux données du portail', async () => {
      const res = await makeRequest('GET', `/api/portal/project?token=${generatedToken1}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.project.id, testProject.id);
    });

    let generatedToken2 = '';
    await test('Régénérer le jeton invalide immédiatement l\'ancien jeton', async () => {
      const res = await generateSecurePortalTokenForProject(testProject.id, ownerUid);
      assert.strictEqual(res.success, true);
      assert.ok(res.token);
      generatedToken2 = res.token!;
      assert.notStrictEqual(generatedToken1, generatedToken2, 'Le nouveau jeton doit être différent');

      // L'ancien jeton doit maintenant échouer (404 / PORTAL_NOT_FOUND)
      const oldRes = await makeRequest('GET', `/api/portal/project?token=${generatedToken1}`);
      assert.strictEqual(oldRes.status, 404);
      assert.strictEqual(oldRes.body.error, 'PORTAL_NOT_FOUND');

      // Le nouveau jeton doit fonctionner
      const newRes = await makeRequest('GET', `/api/portal/project?token=${generatedToken2}`);
      assert.strictEqual(newRes.status, 200);
    });

    console.log('\n3. Tests Révocation du Lien de Partage :');

    await test('Refuse la révocation si non-propriétaire (FORBIDDEN)', async () => {
      const res = await revokePortalTokenForProject(testProject.id, attackerUid);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'FORBIDDEN');
    });

    await test('Révocation du lien (clientLinkActive: false) interdit tout accès ultérieur (403 LINK_REVOKED)', async () => {
      const revRes = await revokePortalTokenForProject(testProject.id, ownerUid);
      assert.strictEqual(revRes.success, true);

      // Tentative d'accès avec le jeton courant
      const portalRes = await makeRequest('GET', `/api/portal/project?token=${generatedToken2}`);
      assert.strictEqual(portalRes.status, 403);
      assert.strictEqual(portalRes.body.error, 'LINK_REVOKED');
      assert.strictEqual(portalRes.body.message, 'Le lien d’accès au portail a été révoqué.');
    });

    await test('Réactivation du lien permet à nouveau l\'accès', async () => {
      const toggleRes = await setPortalLinkStatusForProject(testProject.id, ownerUid, true);
      assert.strictEqual(toggleRes.success, true);

      const portalRes = await makeRequest('GET', `/api/portal/project?token=${generatedToken2}`);
      assert.strictEqual(portalRes.status, 200);
      assert.strictEqual(portalRes.body.success, true);
    });

    console.log('\n3. Tests getClientPortalDataByToken : Confidentialité & Liste Blanche :');

    await test('clientShareToken n\'est JAMAIS renvoyé dans l\'objet safeProject', async () => {
      const res = await makeRequest('GET', `/api/portal/project?token=${generatedToken2}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.project.clientShareToken, undefined, 'clientShareToken ne doit JAMAIS figurer dans project');
    });

    await test('Le champ delivery est EXCLU tant que le solde n\'est pas réglé (budget 1500, payé 500)', async () => {
      const res = await makeRequest('GET', `/api/portal/project?token=${generatedToken2}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.project.delivery, undefined, 'delivery doit être exclu quand solde non réglé');
    });

    await test('Le champ delivery est INCLUS dès que le solde est intégralement réglé (payé 1500)', async () => {
      // Mettons à jour le projet mock pour simuler le paiement intégral
      const proj = getMockPortalProject(testProject.id);
      proj.paidAmount = 1500;
      proj.budget = 1500;
      registerMockPortalProject(proj);

      const res = await makeRequest('GET', `/api/portal/project?token=${generatedToken2}`);
      assert.strictEqual(res.status, 200);
      assert.notStrictEqual(res.body.project.delivery, undefined, 'delivery doit être inclus quand solde réglé');
      assert.deepStrictEqual(res.body.project.delivery.files, ['logo_final.svg', 'charte.pdf']);
    });

    await test('Le champ delivery est EXCLU si une facture associée présente un solde dû restant', async () => {
      // Ajoutons une facture impayée
      const unpaidInvoice = {
        id: 'inv_test_unpaid',
        projectId: testProject.id,
        invoiceNumber: 'FAC-2026-001',
        ownerId: ownerUid,
        workspaceId: 'ws_secret_123',
        status: 'sent',
        totalTTC: 600,
        paidAmount: 0,
        balanceDue: 600,
        internalNotes: 'Attention client difficile',
        payments: [
          { id: 'pay_1', amount: 100, date: '2026-01-01', method: 'virement', notes: 'Note bancaire privée', recordedBy: 'admin' }
        ]
      };
      registerMockPortalInvoice(unpaidInvoice);

      const res = await makeRequest('GET', `/api/portal/project?token=${generatedToken2}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.project.delivery, undefined, 'delivery doit être exclu si une facture a un solde dû');
    });

    console.log('\n4. Tests Liste Blanche stricte des Devis et Factures (aucun ownerId, workspaceId, notes internes) :');

    const testQuote = {
      id: 'quote_test_01',
      projectId: testProject.id,
      quoteNumber: 'DEV-2026-042',
      ownerId: ownerUid,
      workspaceId: 'ws_confidential_999',
      internalNotes: 'Marges élevées négociées',
      notes: 'Privé designer',
      privateNotes: 'Ne pas divulguer',
      title: 'Création Logo & Identité',
      status: 'sent',
      subtotal: 1000,
      vatRate: 20,
      vatAmount: 200,
      totalTTC: 1200,
      depositAmount: 600,
      lines: [
        { id: 'l1', name: 'Logo Vectoriel', unit: 'forfait', unitPrice: 1000, quantity: 1, vatRate: 20, totalHT: 1000, totalTTC: 1200 }
      ]
    };
    registerMockPortalQuote(testQuote);

    await test('Devis assaini : aucun ownerId, aucun workspaceId, aucune note interne', async () => {
      const res = await makeRequest('GET', `/api/portal/project?token=${generatedToken2}`);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.quotes), 'quotes doit être une liste');
      assert.strictEqual(res.body.quotes.length, 1);

      const q = res.body.quotes[0];
      assert.strictEqual(q.quoteNumber, 'DEV-2026-042');
      assert.strictEqual(q.totalTTC, 1200);
      assert.strictEqual(q.ownerId, undefined, 'ownerId doit être exclu du devis');
      assert.strictEqual(q.workspaceId, undefined, 'workspaceId doit être exclu du devis');
      assert.strictEqual(q.internalNotes, undefined, 'internalNotes doit être exclu du devis');
      assert.strictEqual(q.notes, undefined, 'notes doit être exclu du devis');
      assert.strictEqual(q.privateNotes, undefined, 'privateNotes doit être exclu du devis');
    });

    await test('Facture assainie : aucun ownerId, aucun workspaceId, notes de paiements exclues', async () => {
      const res = await makeRequest('GET', `/api/portal/project?token=${generatedToken2}`);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.invoices), 'invoices doit être une liste');
      assert.strictEqual(res.body.invoices.length, 1);

      const inv = res.body.invoices[0];
      assert.strictEqual(inv.invoiceNumber, 'FAC-2026-001');
      assert.strictEqual(inv.ownerId, undefined, 'ownerId doit être exclu de la facture');
      assert.strictEqual(inv.workspaceId, undefined, 'workspaceId doit être exclu de la facture');
      assert.strictEqual(inv.internalNotes, undefined, 'internalNotes doit être exclu de la facture');

      // Vérifier les paiements imbriqués
      assert.ok(Array.isArray(inv.payments), 'payments doit être une liste');
      assert.strictEqual(inv.payments[0].notes, undefined, 'notes de paiement doivent être exclues');
      assert.strictEqual(inv.payments[0].recordedBy, undefined, 'recordedBy doit être exclu');
    });

    console.log('\n5. Tests Messages d\'erreur génériques :');

    await test('Jeton manquant renvoie une erreur générique', async () => {
      const res = await makeRequest('GET', '/api/portal/project');
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'TOKEN_REQUIRED');
      assert.strictEqual(res.body.message, 'Jeton requis.');
    });

    await test('Jeton inconnu renvoie une erreur générique sans trace interne', async () => {
      const res = await makeRequest('GET', '/api/portal/project?token=unknown_random_token_12345');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, 'PORTAL_NOT_FOUND');
      assert.strictEqual(res.body.message, 'Portail client introuvable ou lien invalide.');
    });

    console.log('\n------------------------------------------------------');
    console.log(`RÉSULTAT : ${passed}/${total} tests portail validés.`);
    console.log('✅ TOUTES LES EXIGENCES SUR LES JETONS ET LE PORTAIL CLIENT SONT RESPECTÉES.');

    testServer.close();
    process.exit(0);
  } finally {
    testServer.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Échec critique de la suite de tests :', err);
  process.exit(1);
});
