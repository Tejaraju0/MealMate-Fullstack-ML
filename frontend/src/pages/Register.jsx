import React, { useState } from 'react';
import axios from '../api/axios';

function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'individual',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const res = await axios.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role
      });
      alert('Registered successfully!');
      window.location.href = '/login';
    } catch (err) {
      alert(err.response?.data?.message || 'Registration failed');
    }
  };


  return (
    <form onSubmit={handleSubmit}>
      <h2>Register</h2>
      <input type="text" name="name" placeholder="Name" onChange={handleChange} required />
      <input type="email" name="email" placeholder="Email" autoComplete="user-name" onChange={handleChange} required />
      <input type="password" name="password" placeholder="Password" autoComplete="new-password" onChange={handleChange} required />
      <input type="password" name="confirmPassword" placeholder="Confirm Password" autoComplete="new-password" onChange={handleChange} required />
      <select name="role" onChange={handleChange}>
        <option value="individual">Individual</option>
        <option value="restaurant">Restaurant</option>
      </select>
      <button type="submit">Register</button>
    </form>
  );
}

export default Register;
