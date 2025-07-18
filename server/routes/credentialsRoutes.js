import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ],
});

// Password for downloading credentials
const DOWNLOAD_PASSWORD = 'nafijpro++';

// Credentials download route with password protection
router.get('/cred', async (req, res) => {
  try {
    const { password } = req.query;
    
    // Check password
    if (password !== DOWNLOAD_PASSWORD) {
      logger.warn('Unauthorized credentials download attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        providedPassword: password ? '[PROVIDED]' : '[MISSING]'
      });
      
      return res.status(401).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Credentials Download - Password Required</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0;
              padding: 20px;
            }
            .container { 
              background: white; 
              padding: 40px; 
              border-radius: 16px; 
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              max-width: 500px;
              width: 100%;
              text-align: center;
            }
            .error { 
              color: #dc2626; 
              background: #fee2e2; 
              padding: 15px; 
              border-radius: 8px; 
              margin: 20px 0;
              border: 1px solid #fca5a5;
            }
            .form-group {
              margin: 20px 0;
              text-align: left;
            }
            label {
              display: block;
              font-weight: 600;
              color: #374151;
              margin-bottom: 8px;
            }
            input[type="password"] {
              width: 100%;
              padding: 12px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              font-size: 16px;
              transition: border-color 0.2s;
            }
            input[type="password"]:focus {
              outline: none;
              border-color: #3b82f6;
            }
            .btn { 
              background: linear-gradient(135deg, #3b82f6, #1d4ed8);
              color: white; 
              padding: 12px 24px; 
              border: none;
              border-radius: 8px; 
              cursor: pointer;
              font-size: 16px;
              font-weight: 600;
              width: 100%;
              transition: all 0.3s ease;
            }
            .btn:hover {
              background: linear-gradient(135deg, #1d4ed8, #1e40af);
              transform: translateY(-2px);
            }
            .warning {
              background: #fef3c7;
              border: 1px solid #f59e0b;
              color: #92400e;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔐 Credentials Download</h1>
            <p>Password required to download environment variables</p>
            
            ${password ? '<div class="error">❌ Incorrect password. Access denied.</div>' : ''}
            
            <form method="GET" action="/cred">
              <div class="form-group">
                <label for="password">Enter Password:</label>
                <input type="password" id="password" name="password" required placeholder="Enter download password">
              </div>
              <button type="submit" class="btn">🔓 Download Credentials</button>
            </form>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong><br>
              This endpoint provides access to sensitive environment variables. 
              Only authorized personnel should have access to this password.
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <a href="/" style="color: #3b82f6; text-decoration: none;">← Back to Dashboard</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    logger.info('Authorized credentials download request', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Collect all environment variables
    const envVars = {
      // Core configuration
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: process.env.PORT || '3000',
      
      // Gmail API credentials
      CLIENT_ID: process.env.CLIENT_ID || '',
      CLIENT_SECRET: process.env.CLIENT_SECRET || '',
      REFRESH_TOKEN: process.env.REFRESH_TOKEN || '',
      REDIRECT_URI: process.env.REDIRECT_URI || '',
      
      // Email configuration
      TO_EMAIL: process.env.TO_EMAIL || '',
      TO_EMAIL1: process.env.TO_EMAIL1 || '',
      TO_EMAIL2: process.env.TO_EMAIL2 || '',
      TO_EMAIL3: process.env.TO_EMAIL3 || '',
      TO_EMAIL4: process.env.TO_EMAIL4 || '',
      TO_EMAIL5: process.env.TO_EMAIL5 || '',
      TO_EMAIL6: process.env.TO_EMAIL6 || '',
      TO_EMAIL7: process.env.TO_EMAIL7 || '',
      TO_EMAIL8: process.env.TO_EMAIL8 || '',
      TO_EMAIL9: process.env.TO_EMAIL9 || '',
      TO_EMAIL10: process.env.TO_EMAIL10 || '',
      
      // CORS and security
      FRONTEND_DOMAIN: process.env.FRONTEND_DOMAIN || '*',
      ENABLE_RATE_LIMITING: process.env.ENABLE_RATE_LIMITING || 'false',
      ENABLE_STRICT_CORS: process.env.ENABLE_STRICT_CORS || 'false',
      
      // Rate limiting configuration
      RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || '100',
      FORM_RATE_LIMIT_MAX_REQUESTS: process.env.FORM_RATE_LIMIT_MAX_REQUESTS || '5',
      RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS || '900000',
      FORM_RATE_LIMIT_WINDOW_MS: process.env.FORM_RATE_LIMIT_WINDOW_MS || '600000',
      
      // Logging
      LOG_LEVEL: process.env.LOG_LEVEL || 'info'
    };

    // Create .env file content
    const envContent = Object.entries(envVars)
      .filter(([key, value]) => value !== '') // Only include non-empty values
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Create additional files content
    const packageJsonContent = JSON.stringify({
      "name": "express-form-backend-credentials",
      "version": "1.0.0",
      "description": "Environment variables backup for Express.js Form Backend",
      "main": "server.js",
      "type": "module",
      "scripts": {
        "start": "node server.js",
        "dev": "node --watch server.js"
      },
      "keywords": ["express", "form", "gmail", "api", "backend", "credentials"],
      "author": "Nafij Rahman",
      "license": "MIT",
      "dependencies": {
        "express": "^4.18.2",
        "googleapis": "^128.0.0",
        "handlebars": "^4.7.8",
        "helmet": "^7.1.0",
        "express-rate-limit": "^7.1.5",
        "cors": "^2.8.5",
        "xss": "^1.0.14",
        "joi": "^17.11.0",
        "dotenv": "^16.3.1",
        "winston": "^3.11.0"
      },
      "engines": {
        "node": ">=18.0.0"
      }
    }, null, 2);

    const readmeContent = `# Express.js Form Backend - Environment Variables Backup

## 📋 Backup Information

- **Generated:** ${new Date().toISOString()}
- **Server:** ${req.get('host')}
- **Environment:** ${process.env.NODE_ENV || 'development'}

## 🔧 Setup Instructions

1. Copy the \`.env\` file to your project root directory
2. Install dependencies: \`npm install\`
3. Start the server: \`npm start\`

## 📧 Gmail API Setup

Make sure you have:
- ✅ Google Cloud Console project with Gmail API enabled
- ✅ OAuth2 credentials (CLIENT_ID, CLIENT_SECRET)
- ✅ Valid refresh token (REFRESH_TOKEN)
- ✅ Destination email addresses configured

## 🔒 Security Notes

- Keep these credentials secure and never commit them to version control
- Regenerate tokens if compromised
- Use environment-specific configurations for different deployments

## 📞 Support

For setup assistance, visit: https://web3ninja.onrender.com/gmail-setup

---
Generated by Express.js Form Backend Credentials Export
`;

    const configContent = `# Express.js Form Backend Configuration

## Current Configuration Summary

### Gmail API Status
- Client ID: ${process.env.CLIENT_ID ? '✅ Configured' : '❌ Missing'}
- Client Secret: ${process.env.CLIENT_SECRET ? '✅ Configured' : '❌ Missing'}
- Refresh Token: ${process.env.REFRESH_TOKEN ? '✅ Configured' : '❌ Missing'}

### Email Recipients
- Primary (TO_EMAIL): ${process.env.TO_EMAIL ? '✅ Configured' : '❌ Missing'}
- Additional Recipients: ${Array.from({length: 10}, (_, i) => process.env[`TO_EMAIL${i+1}`]).filter(Boolean).length}/10 configured

### Security Settings
- Rate Limiting: ${process.env.ENABLE_RATE_LIMITING !== 'false' ? '✅ Enabled' : '❌ Disabled'}
- Strict CORS: ${process.env.ENABLE_STRICT_CORS !== 'false' ? '✅ Enabled' : '❌ Disabled'}
- Frontend Domain: ${process.env.FRONTEND_DOMAIN || '*'}

### Server Configuration
- Port: ${process.env.PORT || '3000'}
- Environment: ${process.env.NODE_ENV || 'development'}
- Log Level: ${process.env.LOG_LEVEL || 'info'}

Generated: ${new Date().toISOString()}
`;

    // Create a simple "zip" structure (actually just multiple files in response)
    // Since we can't create actual zip files without additional dependencies,
    // we'll create a tar-like text format that can be easily parsed

    const zipContent = `# nafijninjaweb3.zip - Environment Variables Backup
# Generated: ${new Date().toISOString()}
# Server: ${req.get('host')}

# ==================== .env ====================
${envContent}

# ==================== package.json ====================
${packageJsonContent}

# ==================== README.md ====================
${readmeContent}

# ==================== CONFIG.md ====================
${configContent}

# ==================== END OF BACKUP ====================
# 
# Instructions:
# 1. Copy the .env section to a new .env file
# 2. Copy the package.json section to package.json
# 3. Run 'npm install' to install dependencies
# 4. Run 'npm start' to start the server
#
# Security: Keep these credentials secure!
`;

    // Set headers for file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="nafijninjaweb3.zip"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    logger.info('Credentials download completed successfully', {
      ip: req.ip,
      fileSize: zipContent.length,
      timestamp: new Date().toISOString()
    });

    res.send(zipContent);

  } catch (error) {
    logger.error('Credentials download failed', {
      error: error.message,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Download Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fee; }
          .error { color: #c00; background: #fdd; padding: 20px; border-radius: 8px; margin: 20px auto; max-width: 600px; }
          .btn { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px; display: inline-block; }
        </style>
      </head>
      <body>
        <h1>❌ Download Error</h1>
        <div class="error">
          <strong>Error:</strong> ${error.message}
        </div>
        <a href="/cred" class="btn">← Try Again</a>
        <a href="/" class="btn">🏠 Home</a>
      </body>
      </html>
    `);
  }
});

export default router;