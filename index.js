import fetch from "node-fetch";

const SHOP = process.env.SHOPIFY_SHOP;
const TOKEN = process.env.SHOPIFY_TOKEN;

async function updateShopifyRate() {
  try {
    // 1. Preluăm cursul de la BNR
    const bnrRes = await fetch("https://www.bnr.ro/nbrfxrates.xml");
    const xml = await bnrRes.text();
    const rateMatch = xml.match(/<Rate currency="EUR">([0-9.]+)<\/Rate>/);
    
    if (!rateMatch) throw new Error("Nu am putut găsi cursul EUR în XML-ul BNR.");
    const eurRate = rateMatch[1];
    console.log(`Curs BNR identificat: ${eurRate}`);

    // 2. Obținem ID-ul magazinului (necesar pentru shpss_)
    const shopQuery = { query: "{ shop { id } }" };
    const shopRes = await fetch(`https://${SHOP}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(shopQuery)
    });
    const shopData = await shopRes.json();
    const shopId = shopData.data?.shop?.id;

    if (!shopId) throw new Error("Eroare la conectarea cu Shopify. Verifică TOKEN și DOMENIU.");

    // 3. Actualizăm Metafield-ul
    const mutation = {
      query: `mutation metafieldsSet($input: [MetafieldsSetInput!]!) {
        metafieldsSet(input: $input) {
          userErrors { message }
        }
      }`,
      variables: {
        input: [{
          namespace: "custom",
          key: "eur_rate",
          type: "number_decimal",
          value: eurRate,
          ownerId: shopId
        }]
      }
    };

    const finalRes = await fetch(`https://${SHOP}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(mutation)
    });

    const finalData = await finalRes.json();
    if (finalData.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error("Erori Shopify:", finalData.data.metafieldsSet.userErrors);
    } else {
      console.log("Succes! Cursul a fost actualizat în Shopify.");
    }

  } catch (error) {
    console.error("Eroare Critică:", error.message);
    process.exit(1);
  }
}

updateShopifyRate();
