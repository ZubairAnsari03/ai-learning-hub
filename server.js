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

/* =========================
   PERMANENT ACCESS TOKEN
========================= */

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

  const data = `course-access|${paymentId}`;

  const expectedSignature = crypto
    .createHmac("sha256", ACCESS_SECRET)
    .update(data)
    .digest("hex");

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/* =========================
   PROTECT COURSE PAGES
========================= */

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
        <p>Please complete and verify your payment first.</p>
        <a href="/">Back to AI Learning Hub</a>
      `);
    }
  }

  next();
});

/* =========================
   SERVE WEBSITE
========================= */

app.use(express.static(__dirname));

/* =========================
   RAZORPAY CALLBACK
========================= */

app.get("/payment/callback", async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
      razorpay_signature
    } = req.query;

    if (
      !razorpay_payment_id ||
      !razorpay_payment_link_id ||
      !razorpay_payment_link_status ||
      !razorpay_signature
    ) {
      return res.status(400).send("Invalid payment callback.");
    }

    const referenceId =
      razorpay_payment_link_reference_id || "";

    /* Verify Razorpay signature */

    const payload =
      razorpay_payment_link_id +
      "|" +
      referenceId +
      "|" +
      razorpay_payment_link_status +
      "|" +
      razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(payload)
      .digest("hex");

    if (
      expectedSignature.length !== razorpay_signature.length ||
      !crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpay_signature)
      )
    ) {
      return res.status(403).send(
        "Payment verification failed."
      );
    }

    /* Fetch payment link */

    const paymentLink =
      await razorpay.paymentLink.fetch(
        razorpay_payment_link_id
      );

    /* Verify OUR ₹149 course payment */

    if (
      paymentLink.status !== "paid" ||
      paymentLink.amount !== 14900
    ) {
      return res.status(403).send(
        "Payment is not valid for this course."
      );
    }

    /* Create permanent access token */

    const token =
      createAccessToken(razorpay_payment_id);

    /*
      10 years.
      Browser will keep the access cookie.
      Render restart/redeploy will NOT delete it.
    */

    res.setHeader(
      "Set-Cookie",
      `course_access=${token}; Max-Age=315360000; HttpOnly; SameSite=Lax; Path=/; Secure`
    );

    res.redirect("/course-access.html");

  } catch (error) {
    console.error(
      "Payment verification error:",
      error
    );

    res.status(500).send(
      "Unable to verify payment."
    );
  }
});

/* =========================
   SERVER STATUS
========================= */

app.get("/status", (req, res) => {
  res.json({
    success: true,
    message: "AI Learning Hub server is running"
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `AI Learning Hub running on port ${PORT}`
  );
});