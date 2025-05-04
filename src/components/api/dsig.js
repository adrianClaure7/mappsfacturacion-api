const axios = require('axios');
const config = require('../../../config/config');

class Dsig {
    constructor(certificate, privateKey) {
        this.certificate = certificate;
        this.privateKey = privateKey;
    }
    async signXML(xml) {
        try {
            const dataToSend = { xml, privateKey: this.privateKey, certificate: this.certificate };
            const response = await axios.post(`${config.EXTERNAL_SIGNER_XML}/firmar`, dataToSend, {
                headers: { 'Content-Type': 'application/xml' }
            });
            if (response.data && response.data.xml_firmado) {
                return response.data.xml_firmado;
            } else {
                console.error("❌ Error firmando XML:", error.message);
                throw new Error("❌ Error firmando XML:", "No se pudo firmar el xml");
            }
        } catch (error) {
            console.error("❌ Error firmando XML:", error.message);
            throw error;
        }
    }
}

module.exports = Dsig;
