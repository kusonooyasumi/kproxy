const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const { app } = require('electron');

class CertificateGenerator {
  constructor() {
    this.certsDir = path.join(app.getPath('userData'), 'certificates');
    this.caKeyPath = path.join(this.certsDir, 'ca.key');
    this.caCertPath = path.join(this.certsDir, 'ca.crt');
    
    // Ensure certificates directory exists
    if (!fs.existsSync(this.certsDir)) {
      fs.mkdirSync(this.certsDir, { recursive: true });
    }
  }

  /**
   * Initialize CA certificate if it doesn't exist
   */
  initializeCA() {
    if (!fs.existsSync(this.caKeyPath) || !fs.existsSync(this.caCertPath)) {
      console.log('Generating new CA certificate...');
      const { privateKey, certificate } = this.generateCACertificate();
      
      // Save private key and certificate
      fs.writeFileSync(this.caKeyPath, privateKey);
      fs.writeFileSync(this.caCertPath, certificate);
      
      console.log('CA certificate generated successfully');
    } else {
      console.log('Using existing CA certificate');
    }
    
    // Return CA certificate path for export
    return this.caCertPath;
  }

  /**
   * Generate a new CA certificate
   */
  generateCACertificate() {
    // Generate a new key pair
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    // Create a new certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
    
    // Set certificate attributes
    const attrs = [
      { name: 'commonName', value: 'KProxy CA' },
      { name: 'countryName', value: 'US' },
      { name: 'organizationName', value: 'KProxy' },
      { name: 'organizationalUnitName', value: 'KProxy Certificate Authority' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    
    // Set extensions
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: true,
        critical: true
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        critical: true
      },
      {
        name: 'subjectKeyIdentifier'
      }
    ]);
    
    // Sign the certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());
    
    // Convert to PEM format
    const privateKey = forge.pki.privateKeyToPem(keys.privateKey);
    const certificate = forge.pki.certificateToPem(cert);
    
    return { privateKey, certificate };
  }

  /**
   * Generate a server certificate for a specific domain
   * @param {string} domain - Domain to generate certificate for
   */
  generateServerCertificate(domain) {
    // Load CA certificate and private key
    const caCert = forge.pki.certificateFromPem(fs.readFileSync(this.caCertPath, 'utf8'));
    const caKey = forge.pki.privateKeyFromPem(fs.readFileSync(this.caKeyPath, 'utf8'));
    
    // Generate a new key pair for the server
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    // Create a new certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(16));
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    // Set certificate attributes
    const attrs = [
      { name: 'commonName', value: domain },
      { name: 'countryName', value: 'US' },
      { name: 'organizationName', value: 'KProxy' },
      { name: 'organizationalUnitName', value: 'KProxy Proxy Server' }
    ];
    cert.setSubject(attrs);
    
    // Set issuer to our CA
    cert.setIssuer(caCert.subject.attributes);
    
    // Set extensions
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: false
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: domain }
        ]
      }
    ]);
    
    // Sign the certificate with our CA
    cert.sign(caKey, forge.md.sha256.create());
    
    // Convert to PEM format
    const privateKey = forge.pki.privateKeyToPem(keys.privateKey);
    const certificate = forge.pki.certificateToPem(cert);
    
    return { privateKey, certificate };
  }

  /**
   * Get the path to the CA certificate for export
   */
  getCACertificatePath() {
    return this.caCertPath;
  }
}

module.exports = CertificateGenerator;
