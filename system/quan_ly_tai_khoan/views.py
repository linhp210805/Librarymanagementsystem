from django.contrib import messages
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST
from django.core.mail import send_mail
import json
import random
import string


User = get_user_model()


def login_view(request):
    error_message = ''
    username_value = ''

    if request.method == 'POST':
        username_value = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        user = authenticate(request, username=username_value, password=password)
        if user is None:
            user_obj = User.objects.filter(
                Q(username__iexact=username_value) | Q(email__iexact=username_value)
            ).first()
            if user_obj is not None:
                user = authenticate(request, username=user_obj.get_username(), password=password)

        if user is not None:
            if not user.is_active:
                error_message = 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.'
                return render(
                    request,
                    'quan_ly_tai_khoan/login.html',
                    {'error_message': error_message, 'username_value': username_value},
                )

            login(request, user)
            messages.success(request, 'Đăng nhập thành công.')
            next_url = request.POST.get('next') or request.GET.get('next')
            if not next_url and hasattr(user, 'nguoi_dung') and user.nguoi_dung.loai_nguoi_dung == 'doc_gia':
                return redirect('borrow_list')
            return redirect(next_url or 'dashboard')

        error_message = 'Tài khoản hoặc mật khẩu không đúng.'

    return render(
        request,
        'quan_ly_tai_khoan/login.html',
        {
            'error_message': error_message,
            'username_value': username_value,
        },
    )


def logout_view(request):
    logout(request)
    return redirect('login')


@require_POST
def forgot_password_view(request):
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip()
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Dữ liệu không hợp lệ.'}, status=400)

    if not email:
        return JsonResponse({'success': False, 'message': 'Vui lòng nhập email.'})

    # Kiểm tra email trong hệ thống (User hoặc NguoiDung)
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        # Nếu không có trong User, thử tìm trong NguoiDung
        from quan_ly_nguoi_dung.models import NguoiDung
        nguoi_dung = NguoiDung.objects.filter(email__iexact=email).first()
        if nguoi_dung and nguoi_dung.user:
            user = nguoi_dung.user

    if user:
        # Tạo mã OTP 6 số
        otp = ''.join(random.choices(string.digits, k=6))
        
        # Lưu vào session
        request.session['reset_otp'] = otp
        request.session['reset_email'] = email
        request.session.set_expiry(300)  # Hết hạn sau 5 phút
        
        # Gui email (hien o terminal)
        subject = '[DUE] Ma xac thuc doi mat khau'
        message = f'Ma xac thuc cua ban la: {otp}. Ma nay co hieu luc trong 5 phut.'
        from_email = 'noreply@due.edu.vn'
        
        try:
            send_mail(subject, message, from_email, [email])
            return JsonResponse({
                'success': True, 
                'message': 'Mã xác thực đã được gửi đến email của bạn. Vui lòng kiểm tra.'
            })
        except Exception as e:
            return JsonResponse({
                'success': False, 
                'message': f'Lỗi khi gửi email: {str(e)}'
            })
    else:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy tài khoản'})


@require_POST
def reset_password_view(request):
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip()
        new_password = data.get('new_password', '').strip()
        confirm_password = data.get('confirm_password', '').strip()
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Dữ liệu không hợp lệ.'}, status=400)

    if not email or not new_password or not confirm_password:
        return JsonResponse({'success': False, 'message': 'Vui lòng nhập đầy đủ thông tin.'})

    if new_password != confirm_password:
        return JsonResponse({'success': False, 'message': 'Mật khẩu xác nhận không khớp.'})

    if len(new_password) < 8:
        return JsonResponse({'success': False, 'message': 'Mật khẩu mới phải có ít nhất 8 ký tự.'})

    # Kiểm tra OTP từ session
    session_otp = request.session.get('reset_otp')
    session_email = request.session.get('reset_email')
    
    input_otp = data.get('otp', '').strip()
    
    # DEBUG: In ra để kiểm tra tại sao không khớp
    print(f"DEBUG: Session Email: {session_email}, Input Email: {email}")
    print(f"DEBUG: Session OTP: '{session_otp}', Input OTP: '{input_otp}'")
    
    if not session_otp or not session_email or session_email.lower() != email.lower():
        return JsonResponse({'success': False, 'message': 'Mã xác thực không hợp lệ hoặc đã hết hạn.'})
    
    if input_otp != session_otp:
        return JsonResponse({'success': False, 'message': 'Mã xác thực không hợp lệ hoặc đã hết hạn.'})

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        from quan_ly_nguoi_dung.models import NguoiDung
        nguoi_dung = NguoiDung.objects.filter(email__iexact=email).first()
        if nguoi_dung and nguoi_dung.user:
            user = nguoi_dung.user

    if user:
        user.set_password(new_password)
        user.save()
        
        # Xóa OTP sau khi đổi thành công
        request.session.pop('reset_otp', None)
        request.session.pop('reset_email', None)
        
        return JsonResponse({'success': True, 'message': 'Đặt lại mật khẩu thành công.'})
    else:
        return JsonResponse({'success': False, 'message': 'Không tìm thấy tài khoản để cập nhật.'})
