/* =========================================================
   auth.js - Quen mat khau / doi mat khau
   Khong can thiep submit form login Django
========================================================= */

function showModal(modalId) {
    const forms = document.querySelectorAll('.auth-form-container');
    forms.forEach((form) => form.classList.remove('active'));

    const authPage = document.getElementById('authPage');
    if (authPage) {
        authPage.classList.add('active');
    }

    const targetForm = document.getElementById(modalId);
    if (targetForm) {
        targetForm.classList.add('active');
    }
}

function initAuthState() {
    showModal('loginModal');
}

document.addEventListener('DOMContentLoaded', () => {
    initAuthState();

    const forgotForm = document.getElementById('forgotForm');
    const resetForm = document.getElementById('resetForm');

    if (forgotForm) {
        forgotForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const email = document.getElementById('forgotEmail')?.value.trim();
            if (!email) {
                alert('Vui lòng nhập email.');
                return;
            }

            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;

            fetch('/forgot-password/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ email: email })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert(data.message);
                        // Lưu email để dùng cho bước reset
                        window.currentResetEmail = email;
                        showModal('resetModal');
                    } else {
                        alert(data.message);
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Đã có lỗi xảy ra. Vui lòng thử lại.');
                });
        });
    }

    if (resetForm) {
        resetForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const newPassword = document.getElementById('newPassword')?.value.trim();
            const confirmPassword = document.getElementById('confirmPassword')?.value.trim();
            const otp = document.getElementById('resetOTP')?.value.trim();
            const email = window.currentResetEmail;

            if (!email) {
                alert('Phiên làm việc hết hạn. Vui lòng bắt đầu lại từ bước Quên mật khẩu.');
                showModal('forgotModal');
                return;
            }

            if (!otp || !newPassword || !confirmPassword) {
                alert('Vui lòng nhập đầy đủ thông tin (bao gồm mã OTP).');
                return;
            }

            if (newPassword.length < 8) {
                alert('Mật khẩu mới phải có ít nhất 8 ký tự.');
                return;
            }

            if (newPassword !== confirmPassword) {
                alert('Mật khẩu xác nhận không khớp.');
                return;
            }

            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;

            fetch('/reset-password/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ 
                    email: email,
                    otp: otp,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert(data.message);
                        showModal('loginModal');
                    } else {
                        alert(data.message);
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Đã có lỗi xảy ra. Vui lòng thử lại.');
                });
        });
    }

    const resendOTPLink = document.getElementById('resendOTPLink');
    if (resendOTPLink) {
        resendOTPLink.addEventListener('click', function (e) {
            e.preventDefault();
            const email = window.currentResetEmail;
            if (!email) {
                alert('Phiên làm việc hết hạn. Vui lòng bắt đầu lại từ bước Quên mật khẩu.');
                showModal('forgotModal');
                return;
            }

            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;

            fetch('/forgot-password/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ email: email })
            })
                .then(response => response.json())
                .then(data => {
                    alert(data.message);
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Đã có lỗi xảy ra. Vui lòng thử lại.');
                });
        });
    }
});

window.showModal = showModal;
