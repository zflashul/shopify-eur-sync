// 2. Obținem ID-ul magazinului (necesar pentru shpss_)
    const shopQuery = { query: "{ shop { id } }" };
    const shopRes = await fetch(`https://${SHOP}/admin/api/2024-01/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(shopQuery)
    });

    // Debugging pentru erori de conexiune
    if (shopRes.status !== 200) {
      const errorText = await shopRes.text();
      throw new Error(`Shopify API Error: Status ${shopRes.status} - ${errorText}`);
    }

    const shopData = await shopRes.json();
    const shopId = shopData.data?.shop?.id;
