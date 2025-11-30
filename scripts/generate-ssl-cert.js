const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create SSL directory if it doesn't exist
const sslDir = path.join(__dirname, '..', 'ssl');
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
}

// Generate self-signed certificate using Node.js crypto
const forge = require('node-forge');

// Generate a keypair
console.log('Generating RSA key pair...');
const keys = forge.pki.rsa.generateKeyPair(2048);

// Create a certificate
console.log('Creating self-signed certificate...');
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [
    { name: 'countryName', value: 'US' },
    { name: 'stateOrProvinceName', value: 'Development' },
    { name: 'localityName', value: 'LocalBuy' },
    { name: 'organizationName', value: 'Development' },
    { name: 'commonName', value: 'localhost' }
];

cert.setSubject(attrs);
cert.setIssuer(attrs);

// Add extensions
cert.setExtensions([
    {
        name: 'basicConstraints',
        cA: true
    },
    {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
    },
    {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
        codeSigning: true,
        emailProtection: true,
        timeStamping: true
    },
    {
        name: 'nsCertType',
        client: true,
        server: true,
        email: true,
        objsign: true,
        sslCA: true,
        emailCA: true,
        objCA: true
    },
    {
        name: 'subjectAltName',
        altNames: [
            {
                type: 2, // DNS
                value: 'localhost'
            },
            {
                type: 7, // IP
                ip: '127.0.0.1'
            }
        ]
    }
]);

// Sign the certificate
cert.sign(keys.privateKey);

// Convert to PEM format
const certPem = forge.pki.certificateToPem(cert);
const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

// Write to files
const certPath = path.join(sslDir, 'cert.pem');
const keyPath = path.join(sslDir, 'key.pem');

fs.writeFileSync(certPath, certPem);
fs.writeFileSync(keyPath, keyPem);

console.log('✅ SSL certificate generated successfully!');
console.log(`   Certificate: ${certPath}`);
console.log(`   Private Key: ${keyPath}`);
console.log('');
console.log('⚠️  This is a self-signed certificate for development only.');
console.log('   Your browser will show a security warning that you can safely ignore.');