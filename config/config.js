const config = {
  PORT: 3001,
  CORS_VERIFY: false,
  CORS_ORIGINS: ["http://localhost:4200"],
  JWT_KEY: "REMPLAZAR_A_BASE64_",
  JWT_MERCHANTS_KEY: "REMPLAZAR_A_BASE64_123",
  JWT_EXTERNAL_KEY: "REMPLAZAR_A_BASE64_456",
  JWT_EXP: "8h",
  LOGGER_LEVEL: "trace",
  LOGGER_FILENAME: "log/distribuitor.log",
  /*
  MONGODB_URL: 'mongodb://superAdmin:8f123f4bf80184a86fa35b40a8@138.197.139.178:27017/',
  MONGODB_URL1: 'mongodb://superAdmin:8f123f4bf80184a86fa35b40a8@138.197.139.178:27017',
*/
  MONGODB_URL:
    "mongodb+srv://sa:xsUEAwZ8OI96gXOxpD@mappsfacturacion.ddwdv6w.mongodb.net/",
  MONGODB_URL1:
    "mongodb+srv://sa:xsUEAwZ8OI96gXOxpD@mappsfacturacion.ddwdv6w.mongodb.net",
  SUPER_ADMIN_DB: "merchantsmanager",
  AUTHUSER_DB: "authusers",
  APP_URL: "http://localhost:3001",
  EXTERNAL_MAKRO_URL: "https://apis.makro.com.bo:53100",
  // EXTERNAL_SIGNER_XML: "https://sign-xml.onrender.com",
  EXTERNAL_SIGNER_XML: "https://telocompro-sign-xml-561a0c3dc2fd.herokuapp.com"
};

module.exports = config;