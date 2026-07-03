require('dotenv').config();

const TOKEN    = process.env.AIRTABLE_TOKEN;
const BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE_ID = process.env.AIRTABLE_TABLE_ID;
const FECHA    = new Date().toISOString();

(async () => {
  const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
  url.searchParams.set('filterByFormula', `{estado}="Contactado"`);
  url.searchParams.set('pageSize', '100');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  const json = await res.json();
  const records = json.records || [];
  console.log(`Registros a actualizar: ${records.length}\n`);

  for (const rec of records) {
    const r = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${rec.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { 'Fecha y hora de contacto': FECHA } })
    });
    console.log(r.ok ? `  ✓ ${rec.fields.Name}` : `  ✗ Error en ${rec.fields.Name}`);
  }
  console.log('\nListo.');
})();
