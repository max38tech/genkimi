// Mocking the Rakuten API response and the iteration logic
const mockRakutenResponse = {
  data: {
    Items: [
      {
        Item: {
          itemName: "Product 1 (Missing Image)",
          mediumImageUrls: [],
          itemCaption: "Ingredients: Water, Sugar, Salt."
        }
      },
      {
        Item: {
          itemName: "Product 2 (Missing Caption)",
          mediumImageUrls: [{ imageUrl: "http://example.com/img2.jpg" }],
          itemCaption: ""
        }
      },
      {
        Item: {
          itemName: "Product 3 (Perfect Match)",
          mediumImageUrls: [{ imageUrl: "http://example.com/img3.jpg" }],
          itemCaption: "Ingredients: Flour, Eggs, Milk."
        }
      }
    ]
  }
};

function testIterationLogic(response) {
  const items = response.data.Items || [];
  let finalItem = null;

  for (const itemWrapper of items) {
    const item = itemWrapper.Item;
    const hasImage = item.mediumImageUrls && item.mediumImageUrls.length > 0;
    const hasCaption = item.itemCaption && item.itemCaption.trim().length > 0;

    console.log(`Checking: ${item.itemName} - HasImage: ${hasImage}, HasCaption: ${hasCaption}`);

    if (hasImage && hasCaption) {
      finalItem = {
        name: item.itemName,
        imageUrl: item.mediumImageUrls[0].imageUrl,
        ingredients: item.itemCaption,
      };
      break;
    }
  }

  if (finalItem) {
    console.log("SUCCESS: Found correct item:");
    console.log(JSON.stringify(finalItem, null, 2));
  } else {
    console.log("FAILED: No perfect match found.");
  }
}

console.log("Starting Verification Test...");
testIterationLogic(mockRakutenResponse);
