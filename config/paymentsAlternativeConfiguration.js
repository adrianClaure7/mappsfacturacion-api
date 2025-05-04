'use strict';

/*
* Merchant configuration properties are taken from Configuration module
*/

// common parameters
const AuthenticationType = 'http_signature';

// TEST
const RunEnvironment = 'apitest.cybersource.com';
// PRODCTION
// const RunEnvironment = 'api.cybersource.com';

const MerchantId = 'redenlace_423442';

// http_signature parameters
const MerchantKeyId = '5e53c9a8-dd19-4b9f-8a0f-80c685addbeb'; // 1bdcb08a-0500-4271-a06f-5f10a57aeef5
const MerchantSecretKey = 'buknlWZMRhxRpU6bT/yYavTYw2hSkzJemZcoMxH2BMg='; // nJC61zplTWz2PSxqslTPOQTo53MNDoUEGzNGLnoR7po=

// jwt parameters
const KeysDirectory = 'Resource';
const KeyFileName = 'redenlace_423442';
const KeyAlias = 'redenlace_423442';
const KeyPass = 'redenlace_423442';

//meta key parameters
const UseMetaKey = false;
const PortfolioID = '';

// logging parameters
const EnableLog = true;
const LogFileName = 'cybs';
const LogDirectory = '../log';
const LogfileMaxSize = '5242880'; //10 MB In Bytes

// Constructor for Configuration
function Configuration(config = undefined) {

	var configObj = {
		'authenticationType': AuthenticationType,
		'runEnvironment': RunEnvironment,

		'merchantID': config ? config.MerchantId : MerchantId,
		'merchantKeyId': config ? config.MerchantKeyId : MerchantKeyId,
		'merchantsecretKey': config ? config.MerchantSecretKey : MerchantSecretKey,

		'keyAlias': config ? config.MerchantId : KeyAlias,
		'keyPass': config ? config.MerchantId : KeyPass,
		'keyFileName': config ? config.MerchantId : KeyFileName,
		'keysDirectory': config ? config.MerchantId : KeysDirectory,

		'useMetaKey': UseMetaKey,
		'portfolioID': PortfolioID,

		'enableLog': EnableLog,
		'logFilename': LogFileName,
		'logDirectory': LogDirectory,
		'logFileMaxSize': LogfileMaxSize
	};
	return configObj;

}

module.exports = Configuration;