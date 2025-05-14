const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const Stripe = require("stripe");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(bodyParser.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

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

      // Extract 'amount_subtotal' as 'tickets' and 'custom_fields' for 'playername'
      const tickets = session.amount_subtotal || 0; // Amount in smallest currency unit (e.g., cents)
      const playerName = session.custom_fields?.[0]?.text?.value || "Unknown"; // Assuming the player name is in custom_fields[0].text.value

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
