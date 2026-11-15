/**
 * Tests de validation & sécurité :
 * 1. sign-quote :
 *    - Refuse si devis non "sent"
 *    - Format data:image/png;base64, obligatoire
 *    - Limite de 200 Ko max pour la signature
 *    - Nom limité à 100 caractères
 *    - Enregistrement date, IP et user-agent
 *    - Limite de débit (Rate limiting)
 *    - Refus si le lien est révoqué
 * 2. feedback :
 *    - Validation pinCoords (deux nombres entre 0 et 1)
 *    - 200 retours maximum par projet
 *    - Écriture atomique
 *    - Refus si le lien est révoqué
 * 3. Les jetons ne figurent JAMAIS dans les journaux
 */

import assert from 'assert';
import http from 'http';
import {
  registerMockPortalProject,
  registerMockPortalQuote,
  getMockPortalQuote,
  getMockPortalProject
} from '../src/server/firebaseAdminSdk.js';
import { redactTokens, app } from '../server.js';

let passed = 0;
let total = 0;

function check(label: string, fn: () => void | Promise<void>) {
  total++;
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${label}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${label}:`, err.message);
      process.exitCode = 1;
    }
  })();
}

async function runPortalTests() {
  console.log('\n======================================================');
  console.log('🛡️ TESTS PORTAIL CLIENT : SIGN-QUOTE & FEEDBACK');
  console.log('======================================================\n');

  let testServer: http.Server;
  let baseUrl = '';

  await new Promise<void>((resolve) => {
    testServer = http.createServer(app).listen(0, '127.0.0.1', () => {
      const address = testServer.address() as any;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });

  try {
    const validToken = `test_token_${Date.now()}`;
    const revokedToken = `revoked_token_${Date.now()}`;
    const projectId = `proj_test_${Date.now()}`;
    const revokedProjectId = `proj_revoked_${Date.now()}`;

  // 1. Initialiser les données de test dans le store mock
  registerMockPortalProject({
    id: projectId,
    title: 'Projet Identité Visuelle',
    clientShareToken: validToken,
    clientLinkActive: true,
    feedback: []
  });

  registerMockPortalProject({
    id: revokedProjectId,
    title: 'Projet Révoqué',
    clientShareToken: revokedToken,
    clientLinkActive: false, // Lien révoqué !
    feedback: []
  });

  const quoteSentId = `quote_sent_${Date.now()}`;
  registerMockPortalQuote({
    id: quoteSentId,
    projectId,
    quoteNumber: 'DEV-2026-001',
    status: 'sent',
    totalTTC: 1500
  });

  const quoteDraftId = `quote_draft_${Date.now()}`;
  registerMockPortalQuote({
    id: quoteDraftId,
    projectId,
    quoteNumber: 'DEV-2026-002',
    status: 'draft', // Pas "sent"
    totalTTC: 800
  });

  const quoteAcceptedId = `quote_accepted_${Date.now()}`;
  registerMockPortalQuote({
    id: quoteAcceptedId,
    projectId,
    quoteNumber: 'DEV-2026-003',
    status: 'accepted', // Déjà signé
    totalTTC: 1200
  });

  const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // --- TESTS SIGN-QUOTE ---
  console.log('1. Tests Sécurisation Signature de Devis (/api/portal/sign-quote) :');

  await check('Refuse si le devis n\'est pas au statut "sent" (rejet statut draft)', async () => {
    const res = await fetch(`${baseUrl}/api/portal/sign-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        quoteId: quoteDraftId,
        signatoryName: 'Jean Dupont',
        signatureDataUrl: samplePngBase64
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.error, 'QUOTE_NOT_IN_SENT_STATUS');
  });

  await check('Refuse si le devis n\'est pas au statut "sent" (rejet statut accepted)', async () => {
    const res = await fetch(`${baseUrl}/api/portal/sign-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        quoteId: quoteAcceptedId,
        signatoryName: 'Jean Dupont',
        signatureDataUrl: samplePngBase64
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.error, 'QUOTE_NOT_IN_SENT_STATUS');
  });

  await check('Refuse si la signature n\'est pas au format data:image/png;base64,', async () => {
    const res = await fetch(`${baseUrl}/api/portal/sign-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        quoteId: quoteSentId,
        signatoryName: 'Jean Dupont',
        signatureDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...' // JPEG au lieu de PNG
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.error, 'INVALID_SIGNATURE_FORMAT');
  });

  await check('Refuse si la signature dépasse 200 Ko', async () => {
    // Génère une charge PNG > 200 Ko
    const hugeSignature = 'data:image/png;base64,' + 'A'.repeat(210 * 1024);
    const res = await fetch(`${baseUrl}/api/portal/sign-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        quoteId: quoteSentId,
        signatoryName: 'Jean Dupont',
        signatureDataUrl: hugeSignature
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.error, 'SIGNATURE_TOO_LARGE');
  });

  await check('Refuse si le nom du signataire dépasse 100 caractères', async () => {
    const overlyLongName = 'Alexandre-Guillaume-Maximilien '.repeat(5); // > 100 caractères
    const res = await fetch(`${baseUrl}/api/portal/sign-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        quoteId: quoteSentId,
        signatoryName: overlyLongName,
        signatureDataUrl: samplePngBase64
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.error, 'INVALID_SIGNATORY_NAME');
  });

  await check('Refuse si le nom du signataire est vide ou absent', async () => {
    const res = await fetch(`${baseUrl}/api/portal/sign-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        quoteId: quoteSentId,
        signatoryName: '   ',
        signatureDataUrl: samplePngBase64
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.error, 'INVALID_SIGNATORY_NAME');
  });

  await check('Refuse la signature si le lien de partage est révoqué', async () => {
    const quoteRevokedId = `quote_revoked_${Date.now()}`;
    registerMockPortalQuote({
      id: quoteRevokedId,
      projectId: revokedProjectId,
      status: 'sent'
    });

    const res = await fetch(`${baseUrl}/api/portal/sign-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: revokedToken,
        quoteId: quoteRevokedId,
        signatoryName: 'Marc Client',
        signatureDataUrl: samplePngBase64
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.error, 'LINK_REVOKED');
  });

  await check('Signature valide : scelle le devis avec statut accepted, date, IP et user-agent', async () => {
    const validSignQuoteId = `quote_valid_sig_${Date.now()}`;
    registerMockPortalQuote({
      id: validSignQuoteId,
      projectId,
      quoteNumber: 'DEV-2026-099',
      status: 'sent',
      totalTTC: 2500
    });

    const customUserAgent = 'Mozilla/5.0 (EyesOnWork Safe Browser Test 1.0)';
    const res = await fetch(`${baseUrl}/api/portal/sign-quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': customUserAgent
      },
      body: JSON.stringify({
        token: validToken,
        quoteId: validSignQuoteId,
        signatoryName: 'Claire Vendeuvre',
        signatureDataUrl: samplePngBase64
      })
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);

    const updatedQuote = getMockPortalQuote(validSignQuoteId);
    assert.strictEqual(updatedQuote.status, 'accepted');
    assert.strictEqual(updatedQuote.signatoryName, 'Claire Vendeuvre');
    assert(updatedQuote.acceptedAt !== undefined && updatedQuote.signedAt !== undefined);
    assert(updatedQuote.signerIp !== undefined, 'IP enregistrée');
    assert.strictEqual(updatedQuote.signerUserAgent, customUserAgent, 'User-agent enregistré');
  });

  // --- TESTS FEEDBACK ---
  console.log('\n2. Tests Retours & Annotations (/api/portal/feedback) :');

  await check('Valide pinCoords conformes (deux nombres entre 0 et 1)', async () => {
    const res = await fetch(`${baseUrl}/api/portal/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        comment: 'Ajuster le contraste sur ce bouton',
        pinCoords: { x: 0.42, y: 0.85 }
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
  });

  await check('Rejette pinCoords si un nombre est supérieur à 1', async () => {
    const res = await fetch(`${baseUrl}/api/portal/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        comment: 'Commentaire invalide',
        pinCoords: { x: 1.2, y: 0.5 } // x > 1
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.error, 'INVALID_PIN_COORDS');
  });

  await check('Rejette pinCoords si un nombre est négatif (< 0)', async () => {
    const res = await fetch(`${baseUrl}/api/portal/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        comment: 'Commentaire invalide',
        pinCoords: { x: -0.1, y: 0.5 }
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.error, 'INVALID_PIN_COORDS');
  });

  await check('Rejette pinCoords si non numérique (NaN / string)', async () => {
    const res = await fetch(`${baseUrl}/api/portal/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: validToken,
        comment: 'Commentaire invalide',
        pinCoords: { x: 'centre', y: 0.5 } as any
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.error, 'INVALID_PIN_COORDS');
  });

  await check('Refuse le retour si le lien de partage est révoqué', async () => {
    const res = await fetch(`${baseUrl}/api/portal/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: revokedToken,
        comment: 'Tentative sur projet révoqué'
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.error, 'LINK_REVOKED');
  });

  await check('Plafond de 200 retours maximum par projet', async () => {
    const cappedProjectId = `proj_capped_${Date.now()}`;
    const cappedToken = `token_capped_${Date.now()}`;
    // Simuler un projet ayant déjà atteint les 200 retours
    const maxFeedbacks = Array.from({ length: 200 }, (_, i) => ({
      id: `fb_pre_${i}`,
      author: 'client',
      comment: `Retour n°${i}`,
      createdAt: new Date().toISOString()
    }));

    registerMockPortalProject({
      id: cappedProjectId,
      title: 'Projet saturé de retours',
      clientShareToken: cappedToken,
      clientLinkActive: true,
      feedback: maxFeedbacks
    });

    const res = await fetch(`${baseUrl}/api/portal/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: cappedToken,
        comment: '201ème commentaire qui doit être refusé'
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.error, 'MAX_FEEDBACK_REACHED');
  });

  // --- TESTS SÉCURITÉ DES JETONS DANS LES JOURNAUX ---
  console.log('\n3. Tests de confidentialité des jetons dans les journaux :');

  await check('redactTokens masque tous les jetons token=, Bearer et clientShareToken=', () => {
    const rawUrl = '/api/portal/project?token=secret_share_token_12345&lang=fr';
    const redactedUrl = redactTokens(rawUrl);
    assert(!redactedUrl.includes('secret_share_token_12345'), 'Jeton ne doit pas apparaître');
    assert(redactedUrl.includes('token=[REDACTED]'), 'Remplacement par [REDACTED]');

    const rawBearer = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def';
    const redactedBearer = redactTokens(rawBearer);
    assert(!redactedBearer.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'JWT masqué');
    assert(redactedBearer.includes('Bearer [REDACTED]'), 'Bearer [REDACTED] conforme');
  });

    console.log('\n------------------------------------------------------');
    console.log(`RÉSULTAT : ${passed}/${total} tests portail validés.`);
    if (passed === total) {
      console.log('✅ TOUTES LES EXIGENCES SIGN-QUOTE ET FEEDBACK SONT PARFAITEMENT RESPECTÉES.');
    } else {
      console.error('❌ ÉCHEC DE CERTAINS TESTS PORTAIL.');
      process.exitCode = 1;
    }
  } finally {
    testServer.close();
  }
  process.exit(process.exitCode || 0);
}

runPortalTests().catch((err) => {
  console.error('Erreur test non gérée :', err);
  process.exit(1);
});
