const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const Stripe = require("stripe");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Debugging: Check the Stripe Secret Key is properly loaded
console.log("Stripe Secret Key:", process.env["STRIPE_SECRET_KEY"]);

// Middleware
app.use(bodyParser.json());

// Check if the Firebase service account is available in the environment
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Firebase service account environment variable is missing!");
  process.exit(1); // Exit the app if it's not available
}

let serviceAccount;
try {
  // Parse the service account JSON string from the environment variable
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log("Firebase service account loaded successfully.");
} catch (error) {
  console.error("Error parsing Firebase service account:", error);
  process.exit(1); // Exit the app if the parsing fails
}

// Initialize Firebase Admin SDK with the service account credentials
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Helper function to format the timestamp
const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString("en-AU", { timeZone: "Australia/Sydney" }); // Adjust locale and timezone if needed
};

// Webhook endpoint
app.post("/webhook", async (req, res) => {
  let event = req.body;

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Log session data to verify the correct structure
      console.log("Received Stripe session:", session);

      // Extract 'amount_subtotal' as 'tickets' and 'custom_fields' for 'playername'

      // Recalculate tickets based on $0.50 = 50 cents
      const tickets = session.amount_subtotal
        ? Math.round(session.amount_subtotal / 50)
        : 0;

      const playerName = session.custom_fields?.[0]?.text?.value || "Unknown"; // Assuming the player name is in custom_fields[0].text.value

      // Log extracted data to debug
      console.log(`Extracted playerName: ${playerName}, tickets: ${tickets}`);

      // Get current timestamp and format it
      const timestamp = formatTimestamp(Date.now()); // Get current time in custom format

      // Save to Firestore
      await db.collection("orders").add({
        playerName, // This is extracted from the custom fields
        tickets, // This is extracted from amount_subtotal
        timestamp, // Store the formatted timestamp
        sessionId: session.id,
      });

      console.log(
        `Stored to Firestore: ${playerName} bought ${tickets} tickets on ${timestamp}`,
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(400).send("Webhook handler failed");
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
