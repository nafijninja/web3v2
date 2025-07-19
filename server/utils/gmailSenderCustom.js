import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import handlebars from 'handlebars';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'gmail-sender-custom' },
  transports: [
    new winston.transports.File({ filename: 'email-custom.log' }),
    new winston.transports.Console()
  ],
});

// Import the main Gmail sender functions to reuse credentials
let mainGmailSender;

// Dynamically import the main Gmail sender
async function getMainGmailSender() {
  if (!mainGmailSender) {
    mainGmailSender = await import('./gmailSender.js');
  }
  return mainGmailSender;
}

// Helper function to check if file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Simple email template (fallback) with Form-To branding
const simpleEmailTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>New Form-To Submission</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .content { background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .field { margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .label { font-weight: bold; color: #555; }
        .value { margin-top: 5px; }
        .footer { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; font-size: 12px; color: #666; }
        .custom-destination { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h2>📧 New Form-To Submission</h2>
        <p>Received on {{submissionDate}} at {{submissionTime}}</p>
        <div class="custom-destination">
            <strong>📍 Custom Destination:</strong> This email was sent to a custom destination address via Form-To feature
        </div>
    </div>
    
    <div class="content">
        <div class="field">
            <div class="label">Name:</div>
            <div class="value">{{name}}</div>
        </div>
        
        <div class="field">
            <div class="label">Email:</div>
            <div class="value">{{email}}</div>
        </div>
        
        <div class="field">
            <div class="label">Subject:</div>
            <div class="value">{{subject}}</div>
        </div>
        
        {{#if phone}}
        <div class="field">
            <div class="label">Phone:</div>
            <div class="value">{{phone}}</div>
        </div>
        {{/if}}
        
        {{#if company}}
        <div class="field">
            <div class="label">Company:</div>
            <div class="value">{{company}}</div>
        </div>
        {{/if}}
        
        <div class="field">
            <div class="label">Message:</div>
            <div class="value" style="white-space: pre-wrap;">{{message}}</div>
        </div>
    </div>
    
    <div class="footer">
        <p><strong>Submission ID:</strong> {{submissionId}}</p>
        <p><strong>IP Address:</strong> {{ipAddress}}</p>
        <p><strong>Timestamp:</strong> {{timestamp}}</p>
        <p><strong>Route:</strong> Form-To (Custom Destinations)</p>
        <p>This email was generated automatically by your form-to submission system.</p>
    </div>
</body>
</html>
`;

// Load and compile templates
async function loadTemplate(templateId) {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', `${templateId}.html`);
    
    const templateExists = await fileExists(templatePath);
    if (!templateExists) {
      logger.warn(`Template not found: ${templateId}, using simple template for custom sender`);
      return handlebars.compile(simpleEmailTemplate);
    }
    
    const template = await fs.readFile(templatePath, 'utf-8');
    return handlebars.compile(template);
  } catch (error) {
    logger.warn('Template loading error for custom sender, using simple template', { templateId, error: error.message });
    return handlebars.compile(simpleEmailTemplate);
  }
}

// Convert HTML to plain text
function htmlToText(html) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Main email sending function for custom destinations
export async function sendEmailToCustomDestinations(formData) {
  const emailId = `custom_email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info('🚀 Starting custom email send process', {
      emailId,
      submissionId: formData.submissionId,
      template: formData.template_id,
      destinationCount: formData.destinationEmails.length
    });

    // Get the main Gmail sender to reuse its credentials and functions
    const mainSender = await getMainGmailSender();
    
    // Validate required environment variables
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      throw new Error('CLIENT_ID and CLIENT_SECRET must be configured. Please visit /gmail-auth-select for setup.');
    }

    // Prepare template data
    const templateData = {
      ...formData,
      currentDate: new Date().toLocaleDateString(),
      currentTime: new Date().toLocaleTimeString(),
      currentYear: new Date().getFullYear(),
      submissionDate: new Date(formData.timestamp).toLocaleDateString(),
      submissionTime: new Date(formData.timestamp).toLocaleTimeString(),
      browserInfo: formData.userAgent,
      ipAddress: formData.ip
    };

    // Load and compile template
    const template = await loadTemplate(formData.template_id);
    const htmlContent = template(templateData);
    const textContent = htmlToText(htmlContent);
    
    logger.info('✅ Email template processed successfully for custom sender', { emailId, template: formData.template_id });

    // Create email subject
    const emailSubject = `New Form-To Submission: ${formData.subject}`;

    // Send emails to custom destinations using the main sender's infrastructure
    const results = await sendToCustomDestinationsUsingMainSender(
      emailId,
      formData.destinationEmails,
      emailSubject,
      htmlContent,
      textContent,
      formData,
      mainSender
    );
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    logger.info('🎉 Custom email sending process completed', {
      emailId,
      submissionId: formData.submissionId,
      totalEmails: formData.destinationEmails.length,
      successCount,
      failureCount,
      template: formData.template_id
    });

    return {
      success: true,
      results,
      totalSent: successCount,
      totalFailed: failureCount,
      emailId,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('❌ Custom email sending failed', {
      emailId,
      submissionId: formData.submissionId,
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: error.message,
      emailId,
      details: {
        timestamp: new Date().toISOString(),
        submissionId: formData.submissionId,
        hint: 'Check server logs for detailed error information'
      }
    };
  }
}

// Send emails to custom destinations using the main sender's Gmail client
async function sendToCustomDestinationsUsingMainSender(emailId, destinationEmails, subject, htmlContent, textContent, formData, mainSender) {
  const results = [];
  
  // Create a temporary form data object for each destination
  for (let i = 0; i < destinationEmails.length; i++) {
    const { key, email } = destinationEmails[i];
    const attemptNumber = i + 1;
    
    try {
      logger.info(`📤 Sending custom email ${attemptNumber}/${destinationEmails.length} to ${key}`, {
        emailId,
        recipient: email,
        envKey: key
      });
      
      // Create a temporary environment variable for this destination
      const originalToEmail = process.env.TO_EMAIL;
      process.env.TO_EMAIL = email;
      
      // Create a modified form data object that will send to this specific email
      const customFormData = {
        ...formData,
        customDestination: true,
        originalDestination: email
      };
      
      // Use the main sender's sendEmail function but override the email addresses
      const tempEmailAddresses = [{ key, email }];
      
      // Call the main sender's internal function to send to this specific email
      const result = await sendSingleEmailUsingMainSender(
        email,
        subject,
        htmlContent,
        textContent,
        formData,
        mainSender
      );
      
      // Restore original TO_EMAIL
      process.env.TO_EMAIL = originalToEmail;
      
      if (result.success) {
        logger.info(`✅ ${key} success`, {
          emailId,
          recipient: email,
          messageId: result.messageId,
          envKey: key
        });
        
        results.push({
          success: true,
          envKey: key,
          email,
          messageId: result.messageId,
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      logger.error(`❌ ${key} failed`, {
        emailId,
        recipient: email,
        envKey: key,
        error: error.message
      });
      
      results.push({
        success: false,
        envKey: key,
        email,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Add 1 second delay between emails (except for the last one)
    if (i < destinationEmails.length - 1) {
      logger.info(`⏳ Waiting 1 second before next custom email...`, { emailId });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

// Send a single email using the main sender's infrastructure
async function sendSingleEmailUsingMainSender(toEmail, subject, htmlContent, textContent, formData, mainSender) {
  try {
    // Create a simplified form data object for the main sender
    const simplifiedFormData = {
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      message: formData.message,
      phone: formData.phone,
      company: formData.company,
      template_id: formData.template_id,
      submissionId: formData.submissionId,
      timestamp: formData.timestamp,
      ip: formData.ip,
      userAgent: formData.userAgent
    };
    
    // Temporarily override TO_EMAIL to send to the custom destination
    const originalToEmail = process.env.TO_EMAIL;
    process.env.TO_EMAIL = toEmail;
    
    // Clear other TO_EMAIL variables to ensure only this email is used
    const originalToEmails = {};
    for (let i = 1; i <= 10; i++) {
      const envKey = `TO_EMAIL${i}`;
      originalToEmails[envKey] = process.env[envKey];
      delete process.env[envKey];
    }
    
    try {
      // Use the main sender's sendEmail function
      const result = await mainSender.sendEmail(simplifiedFormData);
      
      if (result.success && result.results && result.results.length > 0) {
        return {
          success: true,
          messageId: result.results[0].messageId
        };
      } else {
        return {
          success: false,
          error: result.error || 'Unknown error from main sender'
        };
      }
    } finally {
      // Restore original environment variables
      process.env.TO_EMAIL = originalToEmail;
      for (let i = 1; i <= 10; i++) {
        const envKey = `TO_EMAIL${i}`;
        if (originalToEmails[envKey]) {
          process.env[envKey] = originalToEmails[envKey];
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}