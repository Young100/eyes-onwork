var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:true});import nodemailer from"nodemailer";import crypto from"crypto";import{persistVerificationCodeToFirestore,persistEmailLogInFirestore}from"./src/server/firestoreAdmin.js";const emailLogs=[];const rateLimits=new Map;const workspaceMonthlySent=new Map;let currentDayKey=new Date().toISOString().slice(0,10);let dailyProviderSentCount=0;function updateDailyCounter(){const today=new Date().toISOString().slice(0,10);if(today!==currentDayKey){currentDayKey=today;dailyProviderSentCount=0}}__name(updateDailyCounter,"updateDailyCounter");function escapeHtml(str){if(str===null||str===void 0)return"";return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}__name(escapeHtml,"escapeHtml");function checkEmailRateLimit(identifier,maxPerMinute=10){const now=Date.now();const current=rateLimits.get(identifier);if(!current||now>=current.resetAt){rateLimits.set(identifier,{count:1,resetAt:now+60*1e3});return{allowed:true,remaining:maxPerMinute-1}}if(current.count>=maxPerMinute){return{allowed:false,remaining:0}}current.count++;return{allowed:true,remaining:maxPerMinute-current.count}}__name(checkEmailRateLimit,"checkEmailRateLimit");function checkWorkspaceMonthlyLimit(workspaceId,maxAllowed=30){const currentMonth=new Date().toISOString().slice(0,7);const entry=workspaceMonthlySent.get(workspaceId);if(!entry||entry.month!==currentMonth){return{allowed:true,currentCount:0,maxAllowed}}return{allowed:entry.count<maxAllowed,currentCount:entry.count,maxAllowed}}__name(checkWorkspaceMonthlyLimit,"checkWorkspaceMonthlyLimit");function incrementWorkspaceMonthlyCount(workspaceId){const currentMonth=new Date().toISOString().slice(0,7);const entry=workspaceMonthlySent.get(workspaceId);if(!entry||entry.month!==currentMonth){workspaceMonthlySent.set(workspaceId,{month:currentMonth,count:1})}else{entry.count++}}__name(incrementWorkspaceMonthlyCount,"incrementWorkspaceMonthlyCount");function getEmailLogs(workspaceId){if(workspaceId&&workspaceId.trim()){return emailLogs.filter(log=>log.workspaceId===workspaceId).slice(0,50)}return emailLogs.slice(0,100)}__name(getEmailLogs,"getEmailLogs");function getMailTransporter(){const user=process.env.GMAIL_USER?.trim();const pass=process.env.GMAIL_APP_PASSWORD?.trim();if(!user||!pass){return null}return nodemailer.createTransport({service:"gmail",host:"smtp.gmail.com",port:465,secure:true,auth:{user,pass}})}__name(getMailTransporter,"getMailTransporter");function formatSenderAddress(studioName){const user=process.env.GMAIL_USER?.trim()||"notifications@eyesonwork.com";const cleanName=(studioName||"Studio Graphique").replace(/"/g,"").trim();return`"${cleanName} via eyes-onwork" <${user}>`}__name(formatSenderAddress,"formatSenderAddress");function getPlatformAdminEmail(){return process.env.ADMIN_EMAIL?.trim()||process.env.GMAIL_USER?.trim()||"ouattaraabdoulaye479@gmail.com"}__name(getPlatformAdminEmail,"getPlatformAdminEmail");const getAdminEmail=getPlatformAdminEmail;function getPlatformProviderConfig(){updateDailyCounter();const transporter=getMailTransporter();const dailyQuota=500;const warningThreshold=450;return{activeProvider:"gmail_smtp",providerName:"Gmail SMTP (Port 465 SSL)",isReady:Boolean(transporter),dailyQuota,dailySentCount:dailyProviderSentCount,dailyRemaining:Math.max(0,dailyQuota-dailyProviderSentCount),quotaWarningThreshold:warningThreshold,isQuotaNearLimit:dailyProviderSentCount>=warningThreshold,requiredEnvVars:[{name:"GMAIL_USER",isSet:Boolean(process.env.GMAIL_USER?.trim()),description:"Adresse email Gmail utilis\xE9e pour l\u2019authentification SMTP."},{name:"GMAIL_APP_PASSWORD",isSet:Boolean(process.env.GMAIL_APP_PASSWORD?.trim()),description:"Mot de passe d\u2019application 16 caract\xE8res g\xE9n\xE9r\xE9 sur myaccount.google.com."},{name:"ADMIN_EMAIL",isSet:Boolean(process.env.ADMIN_EMAIL?.trim()),description:"Email de destination des alertes plateforme du propri\xE9taire."}],planMonthlyQuotas:{free:30,pro:1e3,agency:5e3}}}__name(getPlatformProviderConfig,"getPlatformProviderConfig");function getInitials(name){const parts=name.trim().split(/\s+/);if(parts.length>=2){return(parts[0][0]+parts[1][0]).toUpperCase()}return name.slice(0,2).toUpperCase()||"EO"}__name(getInitials,"getInitials");function getEmailHeaderHtml(title,subtitle,studioName){const displayStudio=escapeHtml(studioName||"Studio Graphique");const initials=escapeHtml(getInitials(studioName||"EO"));return`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0B0F1A; border-bottom: 2px solid #f7c548;">
      <tr>
        <td style="padding: 24px 28px; text-align: left;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="vertical-align: middle;">
                <div style="display: inline-block; width: 42px; height: 42px; background: linear-gradient(135deg, #1A253E, #0E1626); border: 1px solid rgba(247, 197, 72, 0.4); border-radius: 10px; text-align: center; line-height: 40px; vertical-align: middle; margin-right: 14px;">
                  <span style="color: #f7c548; font-weight: 800; font-size: 15px; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${initials}</span>
                </div>
                <div style="display: inline-block; vertical-align: middle;">
                  <h1 style="margin: 0; color: #FFFFFF; font-size: 18px; font-weight: 800; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    ${displayStudio}
                  </h1>
                  <p style="margin: 3px 0 0 0; color: #8E97AB; font-size: 11px; letter-spacing: 0.3px; font-family: sans-serif;">
                    via eyes-onwork \xB7 Espace cr\xE9atif s\xE9curis\xE9
                  </p>
                </div>
              </td>
            </tr>
          </table>
          <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.12);">
            <h2 style="margin: 0; color: #FFFFFF; font-size: 16px; font-weight: 700; font-family: sans-serif;">
              ${escapeHtml(title)}
            </h2>
            ${subtitle?`<p style="margin: 4px 0 0 0; color: #f7c548; font-size: 12px; font-weight: 600; font-family: sans-serif;">${escapeHtml(subtitle)}</p>`:""}
          </div>
        </td>
      </tr>
    </table>
  `}__name(getEmailHeaderHtml,"getEmailHeaderHtml");function getEmailFooterHtml(studioName,replyTo){const displayStudio=escapeHtml(studioName||"Studio Graphique");const safeReplyTo=escapeHtml(replyTo||"");return`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0E1424; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 24px;">
      <tr>
        <td style="padding: 22px 28px; text-align: center; font-family: sans-serif; font-size: 11px; color: #8E97AB; line-height: 1.6;">
          <p style="margin: 0 0 6px 0; font-weight: 700; color: #FFFFFF; letter-spacing: 0.5px;">
            ${displayStudio}
          </p>
          ${safeReplyTo?`
          <p style="margin: 0 0 8px 0; color: #f7c548; font-weight: 500;">
            R\xE9pondre directement au cr\xE9atif : <a href="mailto:${safeReplyTo}" style="color: #f7c548; text-decoration: underline;">${safeReplyTo}</a>
          </p>
          `:""}
          <p style="margin: 8px 0 0 0; font-size: 10px; color: #5F6B84; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
            Email transactionnel \xE9mis de fa\xE7on s\xE9curis\xE9e via eyes-onwork. Vos donn\xE9es sont prot\xE9g\xE9es.
          </p>
        </td>
      </tr>
    </table>
  `}__name(getEmailFooterHtml,"getEmailFooterHtml");function wrapEmailContainer(contentHtml){return`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notification eyes-onwork</title>
      <style>
        body { margin: 0; padding: 0; background-color: #070A12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse; }
        a { text-decoration: none; }
        @media only screen and (max-width: 620px) {
          .email-container { width: 100% !important; }
          .content-cell { padding: 18px 16px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 24px 0; background-color: #070A12;">
      <center>
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width: 600px; max-width: 600px; background-color: #111827; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.5); text-align: left;">
          <tr>
            <td>
              ${contentHtml}
            </td>
          </tr>
        </table>
      </center>
    </body>
    </html>
  `}__name(wrapEmailContainer,"wrapEmailContainer");function buildClientConfirmationEmail(params){const displayStudio=params.studioName||"Studio Graphique";const subject=`Confirmation de votre commande ${params.orderNumber} \u2014 ${params.projectTitle} \xB7 ${displayStudio}`;const safeItems=Array.isArray(params.items)?params.items:[];const itemsRows=safeItems.length>0?(safeItems??[]).map((item,index)=>`
    <tr style="background-color: ${index%2===0?"#1A2338":"#141D30"}; border-bottom: 1px solid rgba(255,255,255,0.06);">
      <td style="padding: 12px 14px; font-size: 13px; color: #FFFFFF; font-family: sans-serif;">
        <strong>${escapeHtml(item?.description||"Prestation graphique")}</strong>
      </td>
      <td style="padding: 12px 14px; font-size: 13px; color: #8E97AB; text-align: center; font-family: sans-serif;">
        ${item?.quantity??1}
      </td>
      <td style="padding: 12px 14px; font-size: 13px; color: #8E97AB; text-align: right; font-family: sans-serif;">
        ${Number(item?.unitPrice??0).toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC
      </td>
      <td style="padding: 12px 14px; font-size: 13px; color: #f7c548; font-weight: 700; text-align: right; font-family: sans-serif;">
        ${Number(item?.total??0).toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC
      </td>
    </tr>
  `).join(""):`
    <tr>
      <td colspan="4" style="padding: 14px; font-size: 13px; color: #8E97AB; text-align: center; font-family: sans-serif;">
        Prestation cr\xE9ative d\xE9finie dans le devis
      </td>
    </tr>
  `;const html=wrapEmailContainer(`
    ${getEmailHeaderHtml("Confirmation de Commande",`R\xE9f : ${params.orderNumber}`,displayStudio)}
    <div class="content-cell" style="padding: 28px 28px 12px 28px; font-family: sans-serif; color: #FFFFFF;">
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px 0; color: #FFFFFF;">
        Bonjour <strong>${escapeHtml(params.clientName)}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #B0B9C8; margin: 0 0 20px 0;">
        Nous avons bien enregistr\xE9 la validation de votre projet <strong>\xAB ${escapeHtml(params.projectTitle)} \xBB</strong>. Merci pour votre confiance !
      </p>

      <div style="background-color: #162035; border-left: 4px solid #f7c548; padding: 14px 18px; margin-bottom: 24px; border-radius: 4px;">
        <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #f7c548; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">
          Statut de la commande
        </span>
        <span style="font-size: 14px; font-weight: 700; color: #FFFFFF;">
          Projet valid\xE9 &amp; Enregistr\xE9 au studio
        </span>
      </div>

      <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #FFFFFF; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">
        D\xE9tail des prestations
      </h3>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background-color: #0E1626; color: #8E97AB;">
            <th style="padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; font-family: sans-serif;">D\xE9signation</th>
            <th style="padding: 10px 14px; text-align: center; font-size: 11px; text-transform: uppercase; font-family: sans-serif;">Qt\xE9</th>
            <th style="padding: 10px 14px; text-align: right; font-size: 11px; text-transform: uppercase; font-family: sans-serif;">P.U. HT</th>
            <th style="padding: 10px 14px; text-align: right; font-size: 11px; text-transform: uppercase; font-family: sans-serif;">Total HT</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <!-- Totaux -->
      <table width="100%" cellpadding="6" cellspacing="0" style="margin-bottom: 24px; font-size: 13px; font-family: sans-serif;">
        <tr>
          <td style="color: #8E97AB;">Total Hors Taxes :</td>
          <td style="text-align: right; color: #FFFFFF; font-weight: 600;">${params.totalHT.toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC</td>
        </tr>
        ${params.vatRate&&params.vatRate>0?`
        <tr>
          <td style="color: #8E97AB;">TVA (${params.vatRate} %) :</td>
          <td style="text-align: right; color: #FFFFFF; font-weight: 600;">${(params.totalTTC-params.totalHT).toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC</td>
        </tr>
        `:""}
        <tr style="border-top: 1px solid rgba(255,255,255,0.15);">
          <td style="font-weight: 800; font-size: 15px; color: #FFFFFF; padding-top: 10px;">Total TTC :</td>
          <td style="text-align: right; font-weight: 800; font-size: 16px; color: #f7c548; padding-top: 10px;">
            ${params.totalTTC.toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC
          </td>
        </tr>
        ${params.depositAmount&&params.depositAmount>0?`
        <tr>
          <td style="color: #5FB59A; font-weight: 600;">Acompte \xE0 r\xE9gler :</td>
          <td style="text-align: right; color: #5FB59A; font-weight: 700;">
            ${params.depositAmount.toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC
          </td>
        </tr>
        `:""}
        ${params.balanceDue&&params.balanceDue>0?`
        <tr>
          <td style="color: #8E97AB;">Solde restant \xE0 la livraison :</td>
          <td style="text-align: right; color: #FFFFFF; font-weight: 600;">
            ${params.balanceDue.toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC
          </td>
        </tr>
        `:""}
      </table>

      ${params.trackingUrl?`
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0 12px 0;">
        <tr>
          <td style="text-align: center;">
            <a href="${escapeHtml(params.trackingUrl)}" style="background: linear-gradient(135deg, #f7c548, #fce49c); color: #0B0F1A; padding: 13px 26px; font-size: 13px; font-weight: 700; font-family: sans-serif; text-decoration: none; border-radius: 8px; display: inline-block;">
              Acc\xE9der \xE0 votre Espace Projet S\xE9curis\xE9 &rarr;
            </a>
          </td>
        </tr>
      </table>
      `:""}
    </div>
    ${getEmailFooterHtml(displayStudio,params.replyTo)}
  `);const text=`
Confirmation de commande ${params.orderNumber} - ${displayStudio}
Projet : ${params.projectTitle}

Bonjour ${params.clientName},

Nous avons bien enregistr\xE9 la validation de votre commande.
Total TTC : ${params.totalTTC.toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC
${params.depositAmount?`Acompte : ${params.depositAmount.toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC
`:""}
${params.trackingUrl?`Votre espace client s\xE9curis\xE9 : ${params.trackingUrl}
`:""}

Merci pour votre confiance,
${displayStudio}
  `.trim();return{subject,html,text}}__name(buildClientConfirmationEmail,"buildClientConfirmationEmail");function buildAdminNotificationEmail(params){const displayStudio=params.studioName||"Mon Studio";const subject=`\u{1F514} Nouveau brief re\xE7u : ${params.projectTitle} (${params.clientCompany||params.clientName}) \xB7 ${displayStudio}`;const html=wrapEmailContainer(`
    ${getEmailHeaderHtml("Nouveau Brief Client","Alerte Studio \xB7 Notification Freelance",displayStudio)}
    <div class="content-cell" style="padding: 26px 28px 12px 28px; font-family: sans-serif; color: #FFFFFF;">
      <div style="background-color: #1A253E; color: #f7c548; padding: 12px 16px; border-left: 4px solid #f7c548; margin-bottom: 20px; font-size: 13px; border-radius: 4px;">
        <strong>ALERTE EN DIRECT :</strong> Un client vient de vous soumettre une nouvelle demande via votre formulaire public.
      </div>

      <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #f7c548;">
        Coordonn\xE9es du client
      </h3>
      <table width="100%" cellpadding="6" cellspacing="0" style="margin-bottom: 20px; font-size: 13px; font-family: sans-serif; background-color: #141D30; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
        <tr>
          <td width="30%" style="color: #8E97AB;">Nom :</td>
          <td width="70%" style="color: #FFFFFF; font-weight: 600;">${escapeHtml(params.clientName)}</td>
        </tr>
        <tr>
          <td style="color: #8E97AB;">Entreprise :</td>
          <td style="color: #FFFFFF;">${escapeHtml(params.clientCompany||"Particulier / Ind\xE9pendant")}</td>
        </tr>
        <tr>
          <td style="color: #8E97AB;">Email :</td>
          <td style="color: #f7c548; font-weight: 600;">
            <a href="mailto:${escapeHtml(params.clientEmail)}" style="color: #f7c548; text-decoration: underline;">${escapeHtml(params.clientEmail)}</a>
          </td>
        </tr>
        ${params.clientPhone?`
        <tr>
          <td style="color: #8E97AB;">T\xE9l\xE9phone :</td>
          <td style="color: #FFFFFF;">${escapeHtml(params.clientPhone)}</td>
        </tr>
        `:""}
      </table>

      <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #f7c548;">
        D\xE9tail du projet
      </h3>
      <table width="100%" cellpadding="6" cellspacing="0" style="margin-bottom: 20px; font-size: 13px; font-family: sans-serif; background-color: #141D30; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
        <tr>
          <td width="30%" style="color: #8E97AB;">Titre :</td>
          <td width="70%" style="color: #FFFFFF; font-weight: 700;">${escapeHtml(params.projectTitle)}</td>
        </tr>
        <tr>
          <td style="color: #8E97AB;">Type :</td>
          <td style="color: #FFFFFF;">${escapeHtml(params.projectType)}</td>
        </tr>
        ${params.estimatedBudget?`
        <tr>
          <td style="color: #8E97AB;">Budget estim\xE9 :</td>
          <td style="color: #5FB59A; font-weight: 700;">${escapeHtml(params.estimatedBudget)}</td>
        </tr>
        `:""}
        ${params.desiredDeadline?`
        <tr>
          <td style="color: #8E97AB;">\xC9ch\xE9ance :</td>
          <td style="color: #FFFFFF;">${escapeHtml(params.desiredDeadline)}</td>
        </tr>
        `:""}
      </table>

      <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #FFFFFF;">
        Description du besoin
      </h3>
      <div style="background-color: #0E1626; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 14px 16px; font-size: 13px; line-height: 1.6; color: #B0B9C8; margin-bottom: 24px; white-space: pre-wrap;">
        ${escapeHtml(params.description)}
      </div>

      ${params.adminUrl?`
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0 10px 0;">
        <tr>
          <td style="text-align: center;">
            <a href="${escapeHtml(params.adminUrl)}" style="background-color: #f7c548; color: #0B0F1A; padding: 12px 24px; font-size: 13px; font-weight: 700; font-family: sans-serif; text-decoration: none; border-radius: 8px; display: inline-block;">
              Ouvrir le projet dans eyes-onwork &rarr;
            </a>
          </td>
        </tr>
      </table>
      `:""}
    </div>
    ${getEmailFooterHtml(displayStudio,params.replyTo)}
  `);const text=`
Nouveau brief re\xE7u : ${params.projectTitle}
Client : ${params.clientName} (${params.clientEmail})
Budget : ${params.estimatedBudget||"Non sp\xE9cifi\xE9"}
Description : ${params.description}
  `.trim();return{subject,html,text}}__name(buildAdminNotificationEmail,"buildAdminNotificationEmail");function buildPaymentReceiptEmail(params){const displayStudio=params.studioName||"Studio Graphique";const subject=`Re\xE7u de paiement \u2014 Facture ${params.invoiceNumber} (${params.projectTitle}) \xB7 ${displayStudio}`;const html=wrapEmailContainer(`
    ${getEmailHeaderHtml("Re\xE7u de Paiement",`Facture R\xE9f : ${params.invoiceNumber}`,displayStudio)}
    <div class="content-cell" style="padding: 26px 28px 12px 28px; font-family: sans-serif; color: #FFFFFF;">
      <p style="font-size: 15px; margin: 0 0 16px 0; color: #FFFFFF;">
        Bonjour <strong>${escapeHtml(params.clientName)}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #B0B9C8; margin: 0 0 20px 0;">
        Nous vous confirmons la bonne r\xE9ception de votre r\xE8glement pour le projet <strong>\xAB ${escapeHtml(params.projectTitle)} \xBB</strong>.
      </p>

      <div style="background-color: #141D30; border: 1px solid rgba(247, 197, 72, 0.3); border-radius: 8px; padding: 18px 22px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #f7c548; letter-spacing: 1px; display: block; margin-bottom: 4px;">
          MONTANT ENCAISS\xC9
        </span>
        <span style="font-size: 30px; font-weight: 800; color: #5FB59A; font-family: sans-serif; display: block;">
          ${params.amountPaid.toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC
        </span>
        <span style="font-size: 12px; color: #8E97AB; margin-top: 4px; display: block;">
          R\xE8glement par ${escapeHtml(params.paymentMethod)} le ${escapeHtml(params.paymentDate)}
        </span>
      </div>

      <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom: 24px; font-size: 13px; font-family: sans-serif; background-color: #0E1626; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
        <tr>
          <td style="color: #8E97AB;">Total de la facture TTC :</td>
          <td style="text-align: right; font-weight: 600; color: #FFFFFF;">${params.totalInvoiceTTC.toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC</td>
        </tr>
        <tr>
          <td style="color: #5FB59A; font-weight: 700;">Versement re\xE7u :</td>
          <td style="text-align: right; font-weight: 800; color: #5FB59A;">- ${params.amountPaid.toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC</td>
        </tr>
        <tr style="border-top: 1px solid rgba(255,255,255,0.15);">
          <td style="font-weight: 800; font-size: 14px; color: #FFFFFF;">Solde restant :</td>
          <td style="text-align: right; font-weight: 800; font-size: 15px; color: ${params.balanceRemaining>0?"#f7c548":"#5FB59A"};">
            ${params.balanceRemaining>0?`${params.balanceRemaining.toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC`:"0,00 \u20AC (Facture sold\xE9e)"}
          </td>
        </tr>
      </table>

      ${params.isFullPayment?`
      <div style="background-color: #142820; border-left: 4px solid #5FB59A; padding: 14px 18px; border-radius: 4px; margin-bottom: 22px; font-size: 13px; line-height: 1.5; color: #D1FAE5;">
        <strong>\u{1F389} Prestation int\xE9gralement sold\xE9e :</strong> Vos livrables finaux haute d\xE9finition (fichiers sources, exports d'impression) sont d\xE9bloqu\xE9s sur votre espace client.
      </div>
      `:""}

      ${params.downloadUrl?`
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0 10px 0;">
        <tr>
          <td style="text-align: center;">
            <a href="${escapeHtml(params.downloadUrl)}" style="background-color: #f7c548; color: #0B0F1A; padding: 12px 24px; font-size: 13px; font-weight: 700; font-family: sans-serif; text-decoration: none; border-radius: 8px; display: inline-block;">
              T\xE9l\xE9charger le Re\xE7u Officiel &rarr;
            </a>
          </td>
        </tr>
      </table>
      `:""}
    </div>
    ${getEmailFooterHtml(displayStudio,params.replyTo)}
  `);const text=`
Re\xE7u de paiement - ${displayStudio}
Facture : ${params.invoiceNumber}
Montant encaiss\xE9 : ${params.amountPaid.toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC
Solde restant : ${params.balanceRemaining.toLocaleString("fr-FR",{minimumFractionDigits:2})} \u20AC
Merci pour votre r\xE8glement.
  `.trim();return{subject,html,text}}__name(buildPaymentReceiptEmail,"buildPaymentReceiptEmail");function buildTestEmail(params){const displayStudio=params.studioName||(params.isPlatformTest?"eyes-onwork Plateforme":"Mon Studio");const subject=params.isPlatformTest?`\u2705 Test du Service d\u2019Envoi Plateforme r\xE9ussi \xB7 eyes-onwork`:`\u2705 Test de Notification r\xE9ussi \xB7 ${displayStudio}`;const nowStr=new Date().toLocaleString("fr-FR",{dateStyle:"full",timeStyle:"medium"});const html=wrapEmailContainer(`
    ${getEmailHeaderHtml("Test de Notification R\xE9ussi",params.isPlatformTest?"V\xE9rification du service d\u2019envoi global":"V\xE9rification de votre adresse de notification",displayStudio)}
    <div class="content-cell" style="padding: 28px 28px 12px 28px; font-family: sans-serif; color: #FFFFFF;">
      <div style="background-color: #142820; border: 1px solid #5FB59A; border-radius: 8px; padding: 18px 20px; margin-bottom: 22px;">
        <span style="font-size: 15px; font-weight: 800; color: #5FB59A; display: block; margin-bottom: 4px;">
          \u2713 R\xE9ception confirm\xE9e
        </span>
        <p style="margin: 0; font-size: 13px; color: #D1FAE5; line-height: 1.5;">
          ${params.isPlatformTest?"Le service d\u2019envoi transactionnel de la plateforme est op\xE9rationnel.":`Vos notifications pour ${displayStudio} sont parfaitement configur\xE9es et fonctionnelles.`}
        </p>
      </div>

      <table width="100%" cellpadding="6" cellspacing="0" style="margin-bottom: 22px; font-size: 13px; font-family: sans-serif; background-color: #141D30; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
        <tr>
          <td width="35%" style="color: #8E97AB;">Destinataire :</td>
          <td width="65%" style="color: #FFFFFF; font-weight: 600;">${escapeHtml(params.recipientEmail)}</td>
        </tr>
        <tr>
          <td style="color: #8E97AB;">Horodatage :</td>
          <td style="color: #FFFFFF;">${nowStr}</td>
        </tr>
        <tr>
          <td style="color: #8E97AB;">Espace :</td>
          <td style="color: #f7c548; font-weight: 600;">${displayStudio}</td>
        </tr>
      </table>
    </div>
    ${getEmailFooterHtml(displayStudio)}
  `);const text=`
Test r\xE9ussi - ${displayStudio}
Destinataire : ${params.recipientEmail}
Horodatage : ${nowStr}
Votre service d'email fonctionne correctement.
  `.trim();return{subject,html,text}}__name(buildTestEmail,"buildTestEmail");function buildVerificationCodeEmail(params){const displayStudio=escapeHtml(params.studioName||"eyes-onwork");const expiration=params.expirationMinutes||10;const safeCode=escapeHtml(params.code);const subject=`${params.code} est votre code de confirmation eyes-onwork`;const html=wrapEmailContainer(`
    ${getEmailHeaderHtml("V\xE9rification de votre compte","Confirmation d\u2019adresse email",displayStudio)}
    <div class="content-cell" style="padding: 32px 28px; color: #E1E7F5; font-size: 14px; line-height: 1.6;">
      <p style="margin: 0 0 16px 0; color: #FFFFFF; font-size: 16px; font-weight: 600;">
        Bienvenue sur eyes-onwork !
      </p>
      <p style="margin: 0 0 24px 0; color: #8E97AB;">
        Pour finaliser la cr\xE9ation de votre compte et s\xE9curiser l\u2019acc\xE8s \xE0 votre espace cr\xE9atif, veuillez saisir le code de v\xE9rification ci-dessous :
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <div style="display: inline-block; background: linear-gradient(135deg, #1A253E, #0E1626); border: 2px solid rgba(247, 197, 72, 0.6); border-radius: 14px; padding: 18px 36px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);">
          <span style="font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 14px; color: #f7c548; display: inline-block; padding-left: 14px;">
            ${safeCode}
          </span>
        </div>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #8E97AB;">
          Ce code est valable pendant <strong style="color: #FFFFFF;">${expiration} minutes</strong>.
        </p>
      </div>

      <div style="margin: 28px 0 0 0; padding: 16px; background-color: rgba(255, 255, 255, 0.04); border-left: 3px solid #f7c548; border-radius: 6px; font-size: 12px; color: #8E97AB;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #FFFFFF;">
          Mesure de s\xE9curit\xE9 :
        </p>
        <p style="margin: 0;">
          Ne transmettez jamais ce code \xE0 un tiers. Si vous n'avez pas cr\xE9\xE9 de compte sur eyes-onwork, vous pouvez ignorer cet email en toute s\xE9curit\xE9.
        </p>
      </div>
    </div>
    ${getEmailFooterHtml(displayStudio)}
  `);
  const text = `
Code de confirmation eyes-onwork : ${params.code}

Votre code est valable pendant ${expiration} minutes.
Pour finaliser la création de votre compte, saisissez ce code sur votre écran de vérification.
  `.trim();
  return { subject, html, text };
}
__name(buildVerificationCodeEmail, "buildVerificationCodeEmail");

function buildPasswordResetCodeEmail(params: {
  code: string;
  recipientEmail: string;
  studioName?: string;
  expirationMinutes?: number;
}) {
  const displayStudio = escapeHtml(params.studioName || "eyes-onwork");
  const expiration = params.expirationMinutes || 10;
  const safeCode = escapeHtml(params.code);
  const subject = `${params.code} est votre code de réinitialisation eyes-onwork`;
  const html = wrapEmailContainer(`
    ${getEmailHeaderHtml("Récupération de mot de passe", "Sécurité du studio", displayStudio)}
    <div class="content-cell" style="padding: 32px 28px; color: #E1E7F5; font-size: 14px; line-height: 1.6;">
      <p style="margin: 0 0 16px 0; color: #FFFFFF; font-size: 16px; font-weight: 600;">
        Demande de réinitialisation de mot de passe
      </p>
      <p style="margin: 0 0 24px 0; color: #8E97AB;">
        Vous avez demandé la réinitialisation de votre mot de passe pour votre espace freelance sur eyes-onwork. Utilisez le code à 6 chiffres ci-dessous pour confirmer votre identité :
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <div style="display: inline-block; background: linear-gradient(135deg, #1A253E, #0E1626); border: 2px solid rgba(247, 197, 72, 0.6); border-radius: 14px; padding: 18px 36px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);">
          <span style="font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 14px; color: #f7c548; display: inline-block; padding-left: 14px;">
            ${safeCode}
          </span>
        </div>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #8E97AB;">
          Ce code est valable pendant <strong style="color: #FFFFFF;">${expiration} minutes</strong>.
        </p>
      </div>

      <div style="margin: 28px 0 0 0; padding: 16px; background-color: rgba(255, 255, 255, 0.04); border-left: 3px solid #f7c548; border-radius: 6px; font-size: 12px; color: #8E97AB;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #FFFFFF;">
          Alerte de sécurité :
        </p>
        <p style="margin: 0;">
          Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe actuel reste inchangé.
        </p>
      </div>
    </div>
    ${getEmailFooterHtml(displayStudio)}
  `);
  const text = `
Code de réinitialisation eyes-onwork : ${params.code}

Votre code est valable pendant ${expiration} minutes.
Pour réinitialiser votre mot de passe, saisissez ce code sur votre écran de récupération.

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.
  `.trim();
  return { subject, html, text };
}
__name(buildPasswordResetCodeEmail, "buildPasswordResetCodeEmail");

const verificationCodesStore = new Map<string, {
  code: string;
  expiresAt: number;
  attempts: number;
  cooldownUntil: number;
  hourlyCount: number;
  hourlyResetAt: number;
  userId?: string;
  invalidated?: boolean;
  used?: boolean;
}>();

function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}
__name(generateVerificationCode, "generateVerificationCode");

function issueVerificationCode(email: string, userId?: string): {
  success: boolean;
  code?: string;
  expiresAt?: number;
  error?: string;
  remainingSeconds?: number;
  message?: string;
} {
  const cleanEmail = email.trim().toLowerCase();
  const now = Date.now();
  const existing = verificationCodesStore.get(cleanEmail);

  if (existing) {
    if (now < existing.hourlyResetAt) {
      if (existing.hourlyCount >= 5) {
        return {
          success: false,
          error: "HOURLY_LIMIT_EXCEEDED",
          message: "Plafond horaire atteint (5 envois max par heure). Veuillez patienter."
        };
      }
    } else {
      existing.hourlyCount = 0;
      existing.hourlyResetAt = now + 60 * 60 * 1000;
    }

    if (now < existing.cooldownUntil) {
      const remainingSeconds = Math.ceil((existing.cooldownUntil - now) / 1000);
      return {
        success: false,
        error: "COOLDOWN",
        remainingSeconds,
        message: `Veuillez patienter ${remainingSeconds}s avant de redemander un code.`
      };
    }
  }

  const code = generateVerificationCode();
  const expiresAt = now + 10 * 60 * 1000;
  const cooldownUntil = now + 60 * 1000;
  const hourlyCount = (existing && now < existing.hourlyResetAt) ? existing.hourlyCount + 1 : 1;
  const hourlyResetAt = (existing && now < existing.hourlyResetAt) ? existing.hourlyResetAt : now + 60 * 60 * 1000;

  verificationCodesStore.set(cleanEmail, {
    code,
    expiresAt,
    attempts: 0,
    cooldownUntil,
    hourlyCount,
    hourlyResetAt,
    userId,
    invalidated: false,
    used: false
  });

  try {
    if (cleanEmail && typeof persistVerificationCodeToFirestore === 'function') {
      persistVerificationCodeToFirestore(cleanEmail, code, expiresAt, userId);
    }
  } catch {}

  return {
    success: true,
    code,
    expiresAt
  };
}
__name(issueVerificationCode, "issueVerificationCode");

function verifySubmittedCode(email: string, submittedCode: string): {
  success: boolean;
  verified?: boolean;
  error?: string;
  remainingAttempts?: number;
  message?: string;
} {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = submittedCode.trim();
  const entry = verificationCodesStore.get(cleanEmail);
  const now = Date.now();

  if (!entry) {
    return {
      success: false,
      error: "EXPIRED_OR_NOT_FOUND",
      message: "Code expiré ou inexistant. Veuillez en redemander un nouveau."
    };
  }

  if (entry.used) {
    return {
      success: false,
      error: "ALREADY_USED",
      message: "Ce code a déjà été utilisé."
    };
  }

  if (entry.invalidated || now > entry.expiresAt) {
    return {
      success: false,
      error: "EXPIRED_OR_NOT_FOUND",
      message: "Code expiré ou inexistant. Veuillez en redemander un nouveau."
    };
  }

  if (entry.attempts >= 5) {
    entry.invalidated = true;
    return {
      success: false,
      error: "MAX_ATTEMPTS",
      remainingAttempts: 0,
      message: "Code invalidé après 5 échecs consécutifs."
    };
  }

  entry.attempts++;

  if (entry.code !== cleanCode) {
    if (entry.attempts >= 5) {
      entry.invalidated = true;
      return {
        success: false,
        error: "MAX_ATTEMPTS",
        remainingAttempts: 0,
        message: "Code invalidé suite à 5 tentatives infructueuses."
      };
    }
    return {
      success: false,
      error: "INVALID_CODE",
      remainingAttempts: 5 - entry.attempts,
      message: `Code incorrect. Il vous reste ${5 - entry.attempts} tentative(s).`
    };
  }

  entry.used = true;
  return {
    success: true,
    verified: true,
    message: "Code validé avec succès."
  };
}
__name(verifySubmittedCode, "verifySubmittedCode");

function getVerificationStatus(email: string): {
  hasPendingCode: boolean;
  cooldownSeconds: number;
  hourlyResendsCount: number;
} {
  const cleanEmail = email.trim().toLowerCase();
  const entry = verificationCodesStore.get(cleanEmail);
  const now = Date.now();

  if (!entry) {
    return {
      hasPendingCode: false,
      cooldownSeconds: 0,
      hourlyResendsCount: 0
    };
  }

  const hasPendingCode = !entry.invalidated && now < entry.expiresAt;
  const cooldownSeconds = Math.max(0, Math.ceil((entry.cooldownUntil - now) / 1000));
  const hourlyResendsCount = now < entry.hourlyResetAt ? entry.hourlyCount : 0;

  return {
    hasPendingCode,
    cooldownSeconds,
    hourlyResendsCount
  };
}
__name(getVerificationStatus, "getVerificationStatus");

async function sendEmailSafe(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateKey?: string;
  recipientName?: string;
  studioName?: string;
  replyTo?: string;
  workspaceId?: string;
  ip?: string;
}): Promise<{
  success: boolean;
  mode: 'live' | 'simulation';
  messageId?: string;
  error?: string;
  log?: any;
}> {
  const {
    to,
    subject,
    html,
    text = '',
    templateKey = 'custom',
    recipientName = 'Destinataire',
    studioName = 'Studio Graphique',
    replyTo,
    workspaceId = 'ws_default',
    ip = '127.0.0.1'
  } = params;

  updateDailyCounter();

  const logEntry = {
    id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    workspaceId,
    recipientEmail: to,
    recipientName,
    subject,
    templateKey,
    sentAt: new Date().toISOString(),
    status: 'delivered' as const,
    provider: 'gmail_smtp',
    ip,
    studioName
  };

  const transporter = getMailTransporter();

  if (!transporter) {
    logEntry.provider = 'simulation';
    emailLogs.unshift(logEntry);
    if (emailLogs.length > 200) emailLogs.pop();
    try {
      if (typeof persistEmailLogInFirestore === 'function') {
        persistEmailLogInFirestore(logEntry);
      }
    } catch {}
    return {
      success: true,
      mode: 'simulation',
      messageId: `sim_${Date.now()}`,
      log: logEntry
    };
  }

  try {
    const from = formatSenderAddress(studioName);
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: text || subject,
      replyTo: replyTo || undefined
    });

    dailyProviderSentCount++;
    incrementWorkspaceMonthlyCount(workspaceId);
    emailLogs.unshift(logEntry);
    if (emailLogs.length > 200) emailLogs.pop();
    try {
      if (typeof persistEmailLogInFirestore === 'function') {
        persistEmailLogInFirestore(logEntry);
      }
    } catch {}

    return {
      success: true,
      mode: 'live',
      messageId: info.messageId,
      log: logEntry
    };
  } catch (err: any) {
    logEntry.status = 'bounced' as const;
    emailLogs.unshift(logEntry);
    if (emailLogs.length > 200) emailLogs.pop();

    return {
      success: false,
      mode: 'live',
      error: err.message || "Erreur d'envoi SMTP",
      log: logEntry
    };
  }
}
__name(sendEmailSafe, "sendEmailSafe");

export{buildAdminNotificationEmail,buildClientConfirmationEmail,buildPaymentReceiptEmail,buildTestEmail,buildVerificationCodeEmail,buildPasswordResetCodeEmail,checkEmailRateLimit,checkWorkspaceMonthlyLimit,escapeHtml,formatSenderAddress,generateVerificationCode,getAdminEmail,getEmailLogs,getMailTransporter,getPlatformAdminEmail,getPlatformProviderConfig,getVerificationStatus,incrementWorkspaceMonthlyCount,issueVerificationCode,sendEmailSafe,verifySubmittedCode};

//# sourceMappingURL=data:application/json;base64,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