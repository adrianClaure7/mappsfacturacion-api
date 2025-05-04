# PaymentsAPI

Lest do that


//'Tests' postman var data = JSON.parse(responseBody); postman.setEnvironmentVariable ("AUTH_TOKEN", data.token)

### aanews /POST
{
    "code": "some code"
}

### merchantConfigs /POST
{
	"invoiceInfo": {
	    "invoiceNum": "673173",
	    "authorizationNum": "8004005263848",
	    "digitalKey": "PNRU4cgz7if)[tr#J69j=yCS57i=uVZ$n@nv6wxaRFP+AUf*L7Adiq3TT[Hw-@wt",
	    "nit": "222",
	    "limitEmitDate": "20181206",
	    "activity": "RESTAURANTES-BARES,WHISKERIAS Y CAFES"
	},
	"productsQuantity": 30,
	"productsPrice": 0,
	"clientCode": "a",
	"clientDatabase": "aDB",
	"expirationDate": "2019-12-31T04:00:00.000Z"
}

### Users /POST
{
    "email": "mappsbo@gmail.com",
    "address": "",
    "status": "",
    "firstName": "Adrian",
    "lastName": "Claure",
    "username": "aadmin",
    "phone": "67011860",
    "password": "aadmin",
    "permissions": [
        {
            "code": "super-admin",
            "description": "CEO Permisos"
        }
    ],
    "createdBy": "aadmin",
    "database": "ColectaManager"
}

### Clients /registerClient /POST
{
  "code": "CLI00001",
  "firstName": "Pedro",
  "lastName": "Perez",
  "phone": "9999999",
  "address": "ALgun lado",
  "database": "aDB",
  "usernameClient": "a",
  "activeUsers": [{
  	"username": "a",
  	"permission": "admin",
  	"price": 100
  },
  {
  	"username": "a1",
  	"permission": "ventas",
  	"price": 100
  },
  {
  	"username": "a2",
  	"permission": "ventas",
  	"price": 100
  }],
  "expirationAlert": false
}
// PRODUCTION IN config alternativo
const RunEnvironment = 'api.cybersource.com';

// TEST IN config alternativo
const RunEnvironment = 'apitest.cybersource.com';
