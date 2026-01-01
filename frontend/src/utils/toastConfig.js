import { toast } from 'react-toastify';

export class ToastManager {
  static success(message, options = {}) {
    return toast.success(message, {
      position: "top-right",
      autoClose: 6000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    });
  }

  static error(message, options = {}) {
    return toast.error(message, {
      position: "top-right",
      autoClose: 7000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    });
  }

  static warning(message, options = {}) {
    return toast.warning(message, {
      position: "top-right",
      autoClose: 6000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    });
  }

  static info(message, options = {}) {
    return toast.info(message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    });
  }

  static loading(message, options = {}) {
    return toast.loading(message, {
      position: "top-right",
      autoClose: false,
      closeOnClick: false,
      draggable: false,
      ...options
    });
  }

  static dismiss(toastId = null) {
    toast.dismiss(toastId);
  }

  static networkError(error) {
    if (error.response?.status === 401) {
      return this.error('Session expired. Please log in again.');
    } else if (error.response?.status === 403) {
      return this.error('You do not have permission to perform this action.');
    } else if (error.response?.status === 404) {
      return this.error('The requested resource was not found.');
    } else if (error.response?.status === 429) {
      return this.warning('Too many requests. Please wait a moment before trying again.');
    } else if (error.response?.status >= 500) {
      return this.error('Server error. Please try again in a few minutes.');
    } else if (error.code === 'NETWORK_ERROR' || !error.response) {
      return this.error('Network error. Please check your connection and try again.');
    } else {
      return this.error(error.response?.data?.message || 'An unexpected error occurred.');
    }
  }
}

export default ToastManager;