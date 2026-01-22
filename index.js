import axios from 'axios';

// Configurare din variabilele de mediu GitHub
const SHOP = process.env.SHOPIFY_SHOP;
const TOKEN = process.env.SHOPIFY_TOKEN;

async function getBNRRate() {
    try {
        const response = await axios.get('https://www.bnr.ro/nbrfxrates.xml');
        const match = response.data.match(/<Rate currency="EUR">([\d.]+)<\/Rate>/);
        return match ? match[1] : null;
    } catch (error) {
        console.error("Eroare la preluarea cursului BNR:", error.message);
        return null;
    }
}

async function getShopId() {
    const query = `{ shop { id } }`;
    try {
        const response = await axios.post(
            `https://${SHOP}/admin/api/2024-01/graphql.json`,
            { query },
            {
                headers: {
                    'X-Shopify-Access-Token': TOKEN,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data?.data?.shop?.id;
    } catch (error) {
        console.error("Eroare la preluarea ID-ului magazinului:", error.message);
        return null;
    }
}

async function updateShopifyRate() {
    const rate = await getBNRRate();
    const shopId = await getShopId();

    if (!rate || !shopId) {
        console.error("Eroare Critică: Nu s-a putut obține cursul sau ID-ul magazinului.");
        process.exit(1);
    }

    console.log(`Curs BNR identificat: ${rate}`);
    console.log(`Magazin: ${SHOP}`);

    const mutation = `
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
        metafields: [
            {
                namespace: "custom",
                key: "curs_eur",
                type: "number_decimal",
                value: rate.toString(),
                ownerId: shopId
            }
        ]
    };

    try {
        const response = await axios.post(
            `https://${SHOP}/admin/api/2024-01/graphql.json`,
            {
                query: mutation,
                variables: variables
            },
            {
                headers: {
                    'X-Shopify-Access-Token': TOKEN,
                    'Content-Type': 'application/json',
                },
            }
        );

        const data = response.data?.data?.metafieldsSet;
        if (data?.userErrors?.length > 0) {
            console.error("Erori la salvarea metafield-ului:", data.userErrors);
            process.exit(1);
        } else {
            console.log(`Succes! Cursul EUR (${rate}) a fost actualizat în Shopify.`);
        }
    } catch (error) {
        console.error("Eroare API Shopify:", error.response ? JSON.stringify(error.response.data) : error.message);
        process.exit(1);
    }
}

updateShopifyRate();
