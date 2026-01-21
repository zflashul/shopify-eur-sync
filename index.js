import fetch from "node-fetch";

// Curățăm automat variabila în caz de erori de scriere
const RAW_SHOP = process.env.SHOPIFY_SHOP || "";
const SHOP = RAW_SHOP.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
const TOKEN = process.env.SHOPIFY_TOKEN;

async function updateShopifyRate() {
  // Verificăm dacă variabila a fost curățată corect
  console.log(`Debug: Încercăm conexiunea la: https://${SHOP}/admin/api/2024-01/graphql.json`);
  
  try {
    if (!SHOP || !TOKEN) {
      throw new Error("Variabilele SHOPIFY_SHOP sau SHOPIFY_TOKEN lipsesc din GitHub Secrets.");
    }

    console.log(`Pornire actualizare pentru magazinul: ${SHOP}`);

    // 1. Preluăm cursul de la BNR
    const bnrRes = await fetch("https://www.bnr.ro/nbrfxrates.xml");
    const xml = await bnrRes.text();
    const rateMatch = xml.match(/<Rate currency="EUR">([0-9.]+)<\/Rate>/);
    
    if (!rateMatch) throw new Error("Nu am putut găsi cursul EUR în XML-ul BNR.");
    const eurRate = rateMatch[1];
    console.log(`Curs BNR identificat: ${eurRate}`);

    // 2. Obținem ID-ul magazinului
    const shopQuery = { query: "{ shop { id } }" };
    const shopRes = await fetch(`https://${SHOP}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: { 
        "X-Shopify-Access-Token": TOKEN, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(shopQuery)
    });

    // Verificăm dacă răspunsul API este valid (Status 200)
    if (shopRes.status !== 200) {
      const errorText = await shopRes.text();
      throw new Error(`Eroare Shopify API: Status ${shopRes.status}. Detalii: ${errorText}`);
    }

    const shopData = await shopRes.json();
    const shopId = shopData.data?.shop?.id;

    if (!shopId) throw new Error("Nu am putut recupera ID-ul magazinului. Verifică permisiunile Token-ului.");

    // 3. Actualizăm Metafield-ul
    const mutation = {
      query: `mutation metafieldsSet($input: [MetafieldsSetInput!]!) {
        metafieldsSet(input: $input) {
          userErrors { field message }
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
      headers: { 
        "X-Shopify-Access-Token": TOKEN, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(mutation)
    });

    const finalData = await finalRes.json();
    
    if (finalData.errors) {
      throw new Error(`Erori GraphQL: ${JSON.stringify(finalData.errors)}`);
    }

    if (finalData.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error("Erori la setarea metafield-ului:", finalData.data.metafieldsSet.userErrors);
    } else {
      console.log(`Succes! Cursul EUR (${eurRate}) a fost actualizat în Shopify.`);
    }

  } catch (error) {
    console.error("Eroare Critică:", error.message);
    process.exit(1);
  }
}

// Executăm funcția
updateShopifyRate();
