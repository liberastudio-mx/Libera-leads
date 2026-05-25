/**
 * Crea los campos necesarios en la tabla de Airtable.
 * Corre una sola vez: node setup-airtable.js
 */

require('dotenv').config();

const TOKEN    = process.env.AIRTABLE_TOKEN;
const BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;

const fields = [
  { name: 'telefono',     type: 'phoneNumber'    },
  { name: 'email',        type: 'email'          },
  { name: 'sitio_web',    type: 'url'            },
  { name: 'direccion',    type: 'singleLineText' },
  { name: 'calificacion', type: 'singleLineText' },
  { name: 'resenas',      type: 'singleLineText' },
  { name: 'categoria',    type: 'singleLineText' },
  { name: 'estado',       type: 'singleSelect',
    options: { choices: [
      { name: 'Sin contactar', color: 'grayLight2' },
      { name: 'Contactado',    color: 'yellowLight2' },
      { name: 'Interesado',    color: 'greenLight2'  },
      { name: 'Descartado',    color: 'redLight2'    },
    ]}
  },
];

async function createField(field) {
  const res = await fetch(
    `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${TABLE_ID}/fields`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(field),
    }
  );
  const json = await res.json();
  if (res.ok) {
    console.log(`✅ Campo creado: ${field.name}`);
  } else if (json.error?.type === 'DUPLICATE_FIELD_NAME') {
    console.log(`— Ya existe: ${field.name}`);
  } else {
    console.log(`❌ Error en ${field.name}: ${JSON.stringify(json.error)}`);
  }
}

(async () => {
  console.log('\nConfigurando campos en Airtable...\n');
  // "nombre" ya existe como campo Name por defecto — lo saltamos
  for (const field of fields) {
    await createField(field);
  }
  console.log('\nListo. Ya puedes correr el scraper.\n');
})();
