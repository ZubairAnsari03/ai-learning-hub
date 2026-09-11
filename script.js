const modules = [
  {
    title: "Intro to AI Module: Getting Started",
    meta: "7 lessons • 30 min",
    lessons: [
      ["Building an AI tool in minutes", "10:16"],
      ["What does the course cover?", "3:17"],
      ["Natural vs Artificial Intelligence", "2:06"],
      ["Brief history of AI", "4:43"],
      ["Demystifying AI, Data Science, ML & Deep Learning", "2:27"],
      ["Weak AI vs Strong AI", "2:43"],
      ["AI tools to accelerate your learning", "4:08"]
    ]
  },
  {
    title: "Intro to AI Module: Data is Essential for Building AI",
    meta: "4 lessons • 10 min",
    lessons: [
      ["Structured vs unstructured data", "1:47"],
      ["How we collect data", "4:02"],
      ["Labelled and unlabelled data", "2:06"],
      ["Metadata: Data that describes data", "1:42"]
    ]
  },
  {
    title: "Intro to AI Module: Key AI Techniques",
    meta: "3 lessons • 20 min",
    lessons: [
      ["Machine learning", "6:15"],
      ["Supervised, Unsupervised & Reinforcement Learning", "5:34"],
      ["Deep learning", "8:27"]
    ]
  },
  {
    title: "Intro to AI Module: Important AI Branches",
    meta: "4 lessons • 15 min",
    lessons: [
      ["Robotics", "4:35"],
      ["Computer vision", "4:34"],
      ["Traditional ML", "1:18"],
      ["Generative AI", "4:05"]
    ]
  },
  {
    title: "Intro to AI Module: Understanding Generative AI",
    meta: "10 lessons • 37 min",
    lessons: [
      ["The rise of Gen AI: Introducing ChatGPT", "2:09"],
      ["Early approaches to Natural Language Processing", "2:42"],
      ["Recent NLP advancements", "3:01"],
      ["From Language Models to Large Language Models (LLMs)", "6:11"],
      ["The efficiency of LLM training", "3:35"],
      ["From N-Grams to RNNs to Transformers", "5:22"],
      ["Phases in building LLMs", "4:40"],
      ["Prompt Engineering vs Fine-tuning vs RAG", "4:24"],
      ["The importance of foundation models", "2:49"],
      ["Buy vs Make: foundation models vs private models", "2:36"]
    ]
  },
  {
    title: "Intro to AI Module: Practical Challenges in Generative AI",
    meta: "4 lessons • 10 min",
    lessons: [
      ["Inconsistency and hallucination", "2:43"],
      ["Budgeting and API costs", "2:58"],
      ["Latency", "1:26"],
      ["Running out of data", "2:25"]
    ]
  },
  {
    title: "Intro to AI Module: The AI Tech Stack",
    meta: "7 lessons • 21 min",
    lessons: [
      ["Python programming", "2:07"],
      ["Working with APIs", "1:35"],
      ["Vector databases", "3:11"],
      ["The importance of open source", "6:10"],
      ["Hugging Face", "1:46"],
      ["LangChain", "2:54"],
      ["AI evaluation tools", "3:07"]
    ]
  },
  {
    title: "AI Job Positions & Looking Ahead",
    meta: "5 lessons • 23 min",
    lessons: [
      ["AI strategist", "5:08"],
      ["AI developer", "4:27"],
      ["AI engineer", "3:53"],
      ["AI ethics", "5:30"],
      ["Future of AI", "4:30"]
    ]
  },
  {
    title: "Python Module: Why Python?",
    meta: "2 lessons • 10 min",
    lessons: [
      ["Programming explained in a few minutes", "5:29"],
      ["Why Python?", "4:32"]
    ]
  }
];

const list = document.getElementById("curriculumList");
list.innerHTML = "";

modules.forEach((m, i) => {
  const el = document.createElement("div");
  el.className = "module" + (i === 0 ? " open" : "");
  el.innerHTML = `
    <button type="button" aria-expanded="${i === 0}">
      <span>
        <strong>${i + 1}. ${m.title}</strong>
        <small>${m.meta}</small>
      </span>
      <span class="arrow">${i === 0 ? "⌃" : "⌄"}</span>
    </button>
    <div class="lessons">
      ${m.lessons.map((l, n) => `
        <div class="lesson">
          <span>▹ ${l[0]}</span>
          <span>${l[1]}</span>
        </div>`).join("")}
    </div>`;
  el.querySelector("button").addEventListener("click", () => {
    const open = el.classList.toggle("open");
    el.querySelector("button").setAttribute("aria-expanded", open);
    el.querySelector(".arrow").textContent = open ? "⌃" : "⌄";
  });
  list.appendChild(el);
});
// ===============================
// RAZORPAY PAYMENT
// ===============================

const payBtn = document.getElementById("payBtn");

if (payBtn) {
  payBtn.addEventListener("click", async () => {
    try {
      payBtn.disabled = true;
      payBtn.textContent = "Opening Payment...";

      const orderResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok || !orderData.success) {
        throw new Error(orderData.message || "Unable to create payment order.");
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "AI Learning Hub",
        description: "AI/ML Engineer Course",
        order_id: orderData.orderId,

        handler: async function (response) {
          try {
            const verifyResponse = await fetch("/api/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify(response)
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(
                verifyData.message || "Payment verification failed."
              );
            }

            window.location.href = "/course-access.html";

          } catch (error) {
            console.error(error);
            alert(
              "Payment ho gaya, lekin verification mein problem aayi. Please contact support."
            );

            payBtn.disabled = false;
            payBtn.textContent = "Continue to Payment →";
          }
        },

        modal: {
          ondismiss: function () {
            payBtn.disabled = false;
            payBtn.textContent = "Continue to Payment →";
          }
        },

        theme: {
          color: "#8b5cf6"
        }
      };

      const razorpay = new Razorpay(options);

      razorpay.on("payment.failed", function (response) {
        console.error("Payment failed:", response.error);

        alert(
          response.error?.description ||
          "Payment failed. Please try again."
        );

        payBtn.disabled = false;
        payBtn.textContent = "Continue to Payment →";
      });

      razorpay.open();

    } catch (error) {
      console.error("Payment error:", error);

      alert(
        error.message || "Unable to start payment. Please try again."
      );

      payBtn.disabled = false;
      payBtn.textContent = "Continue to Payment →";
    }
  });
}
