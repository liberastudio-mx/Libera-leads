require('dotenv').config();

const TOKEN    = process.env.AIRTABLE_TOKEN;
const BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;

console.log('Token:', TOKEN ? TOKEN.slice(0, 20) + '...' : 'NO ENCONTRADO');
console.log('Base ID:', BASE_ID);
console.log('Table ID:', TABLE_ID);

(async () => {
  const res = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [{
          fields: {
            Name:         'TEST — borrar',
            telefono:     '+52 999 000 0000',
            email:        'test@test.com',
            sitio_web:    'https://test.com',
            direccion:    'Mérida, Yucatán',
            calificacion: '5.0',
            resenas:      '10',
            categoria:    'Test',
            estado:       'Sin contactar',
          }
        }]
      }),
    }
  );

  const json = await res.json();
  console.log('\nStatus:', res.status);
  console.log('Respuesta:', JSON.stringify(json, null, 2));
})();
