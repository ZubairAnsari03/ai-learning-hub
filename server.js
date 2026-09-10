const express = require("express");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();
const Razorpay = require("razorpay");

const app = express();
const PORT = process.env.PORT || 3000;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Temporary access sessions
const accessSessions = new Map();

app.use(express.json());

// Protect course-access page
app.use((req, res, next) => {
  const protectedPages = ["/course-access.html", "/access.html"];

  if (protectedPages.includes(req.path)) {
    const token = req.headers.cookie
      ?.split(";")
      .map(x => x.trim())
      .find(x => x.startsWith("course_access="))
      ?.split("=")[1];

    if (!token || !accessSessions.has(token)) {
      return res.status(403).send(`
        <h1>Access Restricted</h1>
        <p>Please complete and verify your payment first.</p>
        <a href="/">Back to AI Learning Hub</a>
      `);
    }
  }

  next();
});

// Serve website
app.use(express.static(__dirname));

// Razorpay Payment Link callback
app.get("/payment/callback", async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
      razorpay_signature
    } = req.query;

    // Required callback fields
    if (
      !razorpay_payment_id ||
      !razorpay_payment_link_id ||
      !razorpay_payment_link_status ||
      !razorpay_signature
    ) {
      return res.status(400).send("Invalid payment callback.");
    }

    // Reference ID is optional
    const paymentLinkReferenceId =
      razorpay_payment_link_reference_id || "";

    // Verify Razorpay Payment Link signature
    const payload =
      razorpay_payment_link_id +
      "|" +
      paymentLinkReferenceId +
      "|" +
      razorpay_payment_link_status +
      "|" +
      razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest("hex");

    // Safe signature comparison
    if (
      expectedSignature.length !== razorpay_signature.length ||
      !crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpay_signature)
      )
    ) {
      return res.status(403).send("Payment verification failed.");
    }

    // Fetch Payment Link directly from Razorpay
    const paymentLink = await razorpay.paymentLink.fetch(
      razorpay_payment_link_id
    );

    // Make sure this is our ₹149 course payment
    if (
      paymentLink.status !== "paid" ||
      paymentLink.amount !== 14900
    ) {
      return res.status(403).send("Payment is not valid for this course.");
    }

    // Create temporary access token
    const token = crypto.randomBytes(32).toString("hex");

    accessSessions.set(token, {
      paymentId: razorpay_payment_id,
      createdAt: Date.now()
    });

    // Access valid for 24 hours
    setTimeout(() => {
      accessSessions.delete(token);
    }, 24 * 60 * 60 * 1000);

    // Give browser the secure access cookie
    res.setHeader(
      "Set-Cookie",
      `course_access=${token}; HttpOnly; SameSite=Lax; Path=/`
    );

    // Send paid customer to course access
    res.redirect("/course-access.html");

  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).send("Unable to verify payment.");
  }
});

// Server status
app.get("/status", (req, res) => {
  res.json({
    success: true,
    message: "AI Learning Hub server is running"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Learning Hub running on port ${PORT}`);
});