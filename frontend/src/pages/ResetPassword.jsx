import React, { useState } from "react";
import axios from "../api/axios";
import { useParams } from "react-router-dom";
import styles from "../css/AuthPage.module.css";
import { toast, ToastContainer } from "react-toastify";

const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await axios.post(`/auth/reset-password/${token}`, { newPassword: password });

      toast.success("Password reset successfully!", {
        position: "top-center",
        autoClose: 1500,
      });

      setTimeout(() => {
        window.location.href = "/auth";
      }, 1500);

    } catch (err) {
      toast.error(err.response?.data?.message || "Reset failed", {
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
          <div className={styles.tagline}>Create New Password</div>
        </div>

        <div className={styles.content}>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label>New Password</label>
              <input
                type="password"
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className={styles.submitBtn}>Reset Password</button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default ResetPassword;
