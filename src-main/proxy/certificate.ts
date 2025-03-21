import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import * as forge from 'node-forge';

/**
 * Certificate Generator for creating and managing CA and server certificates
 */
class CertificateGenerator {
  private certsDir: string;
  private caKeyPath: string;
  private caCertPath: string;

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
   * @returns {string} Path to the CA certificate
   */
  initializeCA(): string {
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
   * @returns {{ privateKey: string; certificate: string }} The generated private key and certificate in PEM format
   */
  private generateCACertificate(): { privateKey: string; certificate: string } {
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
   * @returns {{ privateKey: string; certificate: string }} The generated private key and certificate in PEM format
   */
  generateServerCertificate(domain: string): { privateKey: string; certificate: string } {
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
   * @returns {string} Path to the CA certificate
   */
  getCACertificatePath(): string {
    return this.caCertPath;
  }
}

// Instantiate the certificate generator
const certGenerator = new CertificateGenerator();

// Utility to get app data path
const getProxyDataPath = () => {
  return path.join(app.getPath('userData'), 'proxy');
};

// Ensure proxy data directory exists
const ensureProxyDataDir = () => {
  const proxyDataPath = getProxyDataPath();
  if (!fs.existsSync(proxyDataPath)) {
    fs.mkdirSync(proxyDataPath, { recursive: true });
  }
  return proxyDataPath;
};

// Certificate path
const getCertificatePath = () => {
  // Initialize CA certificate if needed
  certGenerator.initializeCA();
  return certGenerator.getCACertificatePath();
};

// Certificate export
const exportCertificate = async () => {
  try {
    // Initialize CA certificate
    const certificatePath = certGenerator.initializeCA();
    
    return {
      success: true,
      message: `Certificate exported to ${certificatePath}`,
      path: certificatePath
    };
  } catch (error) {
    console.error('Failed to export certificate:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

// Generate server certificate for a domain
const generateServerCertificate = (domain: string) => {
  try {
    return certGenerator.generateServerCertificate(domain);
  } catch (error) {
    console.error(`Failed to generate server certificate for ${domain}:`, error);
    throw error;
  }
};

// Certificate installation instructions
const getCertificateInstructions = () => {
  return {
    windows: 'Open certmgr.msc > Right-click "Trusted Root Certification Authorities" > All Tasks > Import > Browse to the exported certificate file > Complete the wizard.',
    macos: 'Double-click the certificate file > Add to Keychain > In Keychain Access, double-click the imported certificate > Expand "Trust" > Set "When using this certificate" to "Always Trust".',
    firefox: 'Open Firefox > Settings > Privacy & Security > Certificates > View Certificates > Import > Browse to the exported certificate file > Trust this CA to identify websites > OK.',
    chrome: 'Chrome and Edge use the system\'s certificate store on Windows and macOS. For Linux, go to Chrome Settings > Privacy and security > Security > Manage certificates > Authorities > Import.'
  };
};

export {
  getCertificatePath,
  exportCertificate,
  getCertificateInstructions,
  ensureProxyDataDir,
  generateServerCertificate,
  CertificateGenerator
};
