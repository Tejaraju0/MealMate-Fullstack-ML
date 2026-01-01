import React, { useState } from "react";
import axios from "../api/axios";
import styles from "../css/AuthPage.module.css";
import { toast, ToastContainer } from "react-toastify";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await axios.post("/auth/forgot-password", { email });

      toast.success("Reset link sent to your email!", {
        position: "top-center",
        autoClose: 2000,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send reset link", {
        position: "top-center",
        autoClose: 3000,
      });
    }
  };

  return (
    <div className={styles.authPageWrapper}>
      <ToastContainer />
      <div className={styles.container}>

        <div className={styles.header}>
          <div className={styles.logo}>MealMate</div>
          <div className={styles.tagline}>Reset Your Password</div>
        </div>

        <div className={styles.content}>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button className={styles.submitBtn}>Send Reset Link</button>
          </form>

          <div className={styles.backLink}>
            <a href="/auth">← Back to Login</a>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ForgotPassword;
