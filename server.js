const express = require("express");
const crypto = require("crypto");
require("dotenv").config();
const Razorpay = require("razorpay");

const app = express();
const PORT = process.env.PORT || 3000;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ACCESS_SECRET = process.env.RAZORPAY_KEY_SECRET;

function createAccessToken(paymentId) {
  const data = `course-access|${paymentId}`;

  const signature = crypto
    .createHmac("sha256", ACCESS_SECRET)
    .update(data)
    .digest("hex");

  return `${paymentId}.${signature}`;
}

function verifyAccessToken(token) {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const paymentId = parts[0];
  const signature = parts[1];

  const expectedSignature = crypto
    .createHmac("sha256", ACCESS_SECRET)
    .update(`course-access|${paymentId}`)
    .digest("hex");

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Protect course pages
app.use((req, res, next) => {
  const protectedPages = [
    "/course-access.html",
    "/access.html"
  ];

  if (protectedPages.includes(req.path)) {
    const token = req.headers.cookie
      ?.split(";")
      .map(x => x.trim())
      .find(x => x.startsWith("course_access="))
      ?.split("=")[1];

    if (!verifyAccessToken(token)) {
      return res.status(403).send(`
        <h1>Access Restricted</h1>
        <p>Please complete your payment first.</p>
        <a href="/">Back to AI Learning Hub</a>
      `);
    }
  }

  next();
});

app.use(express.static(__dirname));

// ==========================================
// CREATE ₹149 RAZORPAY ORDER
// ==========================================

app.post("/api/create-order", async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 14900,
      currency: "INR",
      receipt: `course_${Date.now()}`,
      notes: {
        product: "AI/ML Engineer Course 2026"
      }
    });

    console.log("Order created:", order.id);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error("Create order error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create payment."
    });
  }
});

// ==========================================
// VERIFY PAYMENT
// ==========================================

app.post("/api/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing payment details."
      });
    }

    const body =
      razorpay_order_id +
      "|" +
      razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(body)
      .digest("hex");

    if (
      expectedSignature.length !== razorpay_signature.length ||
      !crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpay_signature)
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Payment verification failed."
      });
    }

    // Fetch actual payment from Razorpay
    const payment =
      await razorpay.payments.fetch(
        razorpay_payment_id
      );

    if (
      payment.status !== "captured" ||
      payment.amount !== 14900 ||
      payment.currency !== "INR" ||
      payment.order_id !== razorpay_order_id
    ) {
      return res.status(403).json({
        success: false,
        message: "Invalid course payment."
      });
    }

    // Give browser access
    const token =
      createAccessToken(razorpay_payment_id);

    res.setHeader(
      "Set-Cookie",
      `course_access=${token}; Max-Age=315360000; HttpOnly; SameSite=Lax; Path=/; Secure`
    );

    console.log(
      "COURSE ACCESS GRANTED:",
      razorpay_payment_id
    );

    res.json({
      success: true,
      redirect: "/course-access.html"
    });

  } catch (error) {
    console.error("Verify payment error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to verify payment."
    });
  }
});

// ==========================================
// STATUS
// ==========================================

app.get("/status", (req, res) => {
  res.json({
    success: true,
    message: "AI Learning Hub server is running"
  });
});

// ==========================================
// START
// ==========================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `AI Learning Hub running on port ${PORT}`
  );
});