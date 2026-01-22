const SHOP = process.env.SHOPIFY_SHOP;
const TOKEN = process.env.SHOPIFY_TOKEN;

async function getBNRRate() {
    try {
        const response = await fetch('https://www.bnr.ro/nbrfxrates.xml');
        const text = await response.text();
        const match = text.match(/<Rate currency="EUR">([\d.]+)<\/Rate>/);
        return match ? match[1] : null;
    } catch (error) {
        console.error("Eroare la preluarea cursului BNR:", error.message);
        return null;
    }
}

async function getShopId() {
    const query = JSON.stringify({ query: `{ shop { id } }` });
    try {
        const response = await fetch(`https://${SHOP}/admin/api/2024-01/graphql.json`, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': TOKEN,
                'Content-Type': 'application/json',
            },
            body: query
        });
        const data = await response.json();
        return data?.data?.shop?.id;
    } catch (error) {
        console.error("Eroare la preluarea ID-ului magazinului:", error.message);
        return null;
    }
}

async function updateShopifyRate() {
    const rate = await getBNRRate();
    const shopId = await getShopId();

    if (!rate || !shopId) {
        console.error("Eroare Critică: Nu s-au putut obține datele necesare.");
        process.exit(1);
    }

    console.log(`Curs BNR: ${rate} | Magazin: ${SHOP}`);

    const mutation = JSON.stringify({
        query: `
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields { key value }
              userErrors { field message }
            }
          }
        `,
        variables: {
            metafields: [{
                namespace: "custom",
                key: "curs_eur",
                type: "number_decimal",
                value: rate.toString(),
                ownerId: shopId
            }]
        }
    });

    try {
        const response = await fetch(`https://${SHOP}/admin/api/2024-01/graphql.json`, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': TOKEN,
                'Content-Type': 'application/json',
            },
            body: mutation
        });

        const result = await response.json();
        const errors = result?.data?.metafieldsSet?.userErrors;

        if (errors && errors.length > 0) {
            console.error("Erori Shopify:", errors);
            process.exit(1);
        } else {
            console.log(`Succes! Cursul EUR (${rate}) a fost actualizat în Shopify.`);
        }
    } catch (error) {
        console.error("Eroare la trimiterea datelor către Shopify:", error.message);
        process.exit(1);
    }
}

updateShopifyRate();
