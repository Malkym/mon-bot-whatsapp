const nodemailer = require('nodemailer');
const { config } = require('./config');
const logger = require('./logger');

let transporter = null;

function isConfigured() {
    return !!(config.email.host && config.email.user && config.email.pass);
}

function createTransporter() {
    if (!isConfigured()) return null;
    transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: {
            user: config.email.user,
            pass: config.email.pass,
        },
    });
    return transporter;
}

async function sendEmail(to, subject, text) {
    if (!transporter) createTransporter();
    if (!transporter) throw new Error('Email non configure - verifie EMAIL_HOST, EMAIL_USER, EMAIL_PASS');

    const info = await transporter.sendMail({
        from: config.email.from || config.email.user,
        to,
        subject,
        text,
    });

    logger.info(`📧 Email envoye a ${to}: "${subject}" (id: ${info.messageId})`);
    return info;
}

async function verifyConfig() {
    if (!isConfigured()) {
        logger.warn('⚠️ Email non configure - desactive');
        return false;
    }
    try {
        if (!transporter) createTransporter();
        await transporter.verify();
        logger.info('✅ Email configure et pret');
        return true;
    } catch (error) {
        logger.error('❌ Email: echec verification SMTP', { error: error.message });
        return false;
    }
}

module.exports = {
    sendEmail,
    verifyConfig,
    isConfigured,
};
