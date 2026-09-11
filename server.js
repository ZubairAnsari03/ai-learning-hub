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

// =====================================================
// CREATE ACCESS TOKEN
// =====================================================

function createAccessToken(paymentId) {
  const data = `course-access|${paymentId}`;

  const signature = crypto
    .createHmac("sha256", ACCESS_SECRET)
    .update(data)
    .digest("hex");

  return `${paymentId}.${signature}`;
}

// =====================================================
// VERIFY ACCESS TOKEN
// =====================================================

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

// =====================================================
// PROTECT COURSE PAGES
// =====================================================

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

// =====================================================
// SERVE WEBSITE
// =====================================================

app.use(express.static(__dirname));

// =====================================================
// RAZORPAY CALLBACK
// =====================================================

app.get("/payment/callback", async (req, res) => {

  try {

    console.log("Razorpay callback received:", req.query);

    const {
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
      razorpay_signature
    } = req.query;

    // -------------------------------------------------
    // CHECK CALLBACK PARAMETERS
    // -------------------------------------------------

    if (
      !razorpay_payment_id ||
      !razorpay_payment_link_id ||
      !razorpay_payment_link_status ||
      !razorpay_signature
    ) {
      return res.status(400).send(`
        <h2>Invalid payment callback.</h2>
        <p>Please return to the website and try again.</p>
      `);
    }

    const referenceId =
      razorpay_payment_link_reference_id || "";

    // -------------------------------------------------
    // VERIFY RAZORPAY SIGNATURE
    // -------------------------------------------------

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

    // -------------------------------------------------
    // FETCH PAYMENT LINK
    // -------------------------------------------------

    const paymentLink =
      await razorpay.paymentLink.fetch(
        razorpay_payment_link_id
      );

    console.log("Payment link:", paymentLink);

    // -------------------------------------------------
    // VERIFY OUR COURSE PAYMENT
    // -------------------------------------------------

    if (
      paymentLink.status !== "paid" ||
      paymentLink.amount !== 14900
    ) {
      return res.status(403).send(
        "Payment is not valid for this course."
      );
    }

    // -------------------------------------------------
    // CREATE ACCESS
    // -------------------------------------------------

    const token =
      createAccessToken(razorpay_payment_id);

    res.setHeader(
      "Set-Cookie",
      `course_access=${token}; Max-Age=315360000; HttpOnly; SameSite=Lax; Path=/; Secure`
    );

    console.log(
      "Course access granted:",
      razorpay_payment_id
    );

    return res.redirect("/course-access.html");

  } catch (error) {

    console.error(
      "Payment verification error:",
      error
    );

    return res.status(500).send(
      "Unable to verify payment."
    );
  }
});

// =====================================================
// PAYMENT RECOVERY
// =====================================================
// This is for a payment that succeeded but Razorpay
// did not redirect the customer correctly.
// =====================================================

app.get("/payment/recover", async (req, res) => {

  try {

    const paymentId = req.query.payment_id;

    if (!paymentId) {
      return res.status(400).send(`
        <h2>Payment ID required</h2>
        <p>Please use your Razorpay Payment ID.</p>
      `);
    }

    console.log(
      "Recovery requested for:",
      paymentId
    );

    // Fetch actual payment from Razorpay
    const payment =
      await razorpay.payments.fetch(paymentId);

    console.log("Payment found:", payment);

    // -------------------------------------------------
    // VERIFY PAYMENT
    // -------------------------------------------------

    if (
      payment.status !== "captured" ||
      payment.amount !== 14900 ||
      payment.currency !== "INR"
    ) {
      return res.status(403).send(`
        <h2>Payment could not be verified.</h2>
        <p>The payment is not a valid ₹149 course payment.</p>
      `);
    }

    // -------------------------------------------------
    // VERIFY THAT PAYMENT BELONGS TO OUR PAYMENT LINK
    // -------------------------------------------------

    const paymentLink =
      await razorpay.paymentLink.fetch(
        "plink_TaNFbzMP9JP4eG"
      );

    if (
      paymentLink.status !== "paid" ||
      paymentLink.amount !== 14900
    ) {
      return res.status(403).send(
        "Course payment link is not valid."
      );
    }

    // Payment must appear in this payment link
    const linkedPayments =
      paymentLink.payments || [];

    const belongsToCourse =
      linkedPayments.some(
        p =>
          p.payment_id === paymentId ||
          p.id === paymentId
      );

    if (!belongsToCourse) {
      return res.status(403).send(`
        <h2>Payment verification failed.</h2>
        <p>This payment is not linked to the course payment.</p>
      `);
    }

    // -------------------------------------------------
    // GRANT ACCESS
    // -------------------------------------------------

    const token =
      createAccessToken(paymentId);

    res.setHeader(
      "Set-Cookie",
      `course_access=${token}; Max-Age=315360000; HttpOnly; SameSite=Lax; Path=/; Secure`
    );

    console.log(
      "Recovery successful:",
      paymentId
    );

    return res.redirect("/course-access.html");

  } catch (error) {

    console.error(
      "Recovery error:",
      error
    );

    return res.status(500).send(`
      <h2>Payment recovery failed.</h2>
      <p>Please check the Razorpay Payment ID.</p>
    `);
  }
});

// =====================================================
// SERVER STATUS
// =====================================================

app.get("/status", (req, res) => {

  res.json({
    success: true,
    message: "AI Learning Hub server is running"
  });

});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `AI Learning Hub running on port ${PORT}`
  );

});