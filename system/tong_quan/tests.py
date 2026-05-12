from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from muon_sach.models import ChiTietPhieuMuon, PhieuMuon
from quan_ly_nguoi_dung.models import NguoiDung
from quan_ly_sach.models import Sach
from tra_sach.models import ChinhSachPhat, KhoanPhat


class DashboardViewTests(TestCase):
	def test_dashboard_requires_login(self):
		response = self.client.get(reverse('dashboard'))
		self.assertEqual(response.status_code, 302)
		self.assertIn('/?next=', response.url)

	def test_dashboard_uses_database_data(self):
		today = timezone.localdate()

		admin_user = User.objects.create_user(username='admin', password='123456')
		admin_nd = NguoiDung.objects.create(
			ma_nguoi_dung='QT001',
			user=admin_user,
			loai_nguoi_dung='quan_tri',
			ho_ten='Quan tri',
		)

		reader = NguoiDung.objects.create(
			ma_nguoi_dung='DG001',
			loai_nguoi_dung='doc_gia',
			ho_ten='Doc gia 1',
		)
		NguoiDung.objects.create(
			ma_nguoi_dung='DG002',
			loai_nguoi_dung='doc_gia',
			ho_ten='Doc gia 2',
			trang_thai_tot_nghiep=True,
		)

		book = Sach.objects.create(
			ten_sach='Clean Code',
			ten_tac_gia='Robert C. Martin',
			the_loai='CNTT',
			ten_nha_xuat_ban='Prentice Hall',
			nam_xuat_ban=2008,
			so_luong=4,
		)
		overdue_item, borrowed_item, *_ = list(book.sach_trong_kho.all())

		overdue_item.trang_thai_sach = 'overdue'
		overdue_item.save(update_fields=['trang_thai_sach'])
		borrowed_item.trang_thai_sach = 'borrowed'
		borrowed_item.save(update_fields=['trang_thai_sach'])

		loan = PhieuMuon.objects.create(
			ma_phieu_muon='PM0000001',
			ma_nguoi_dung=reader,
			nguoi_tao=admin_nd,
			ngay_muon=today - timedelta(days=7),
			trang_thai='dang_muon',
		)
		ChiTietPhieuMuon.objects.create(
			ma_phieu_muon=loan,
			ma_sach_trong_kho=overdue_item,
			han_tra=today - timedelta(days=2),
		)
		ChiTietPhieuMuon.objects.create(
			ma_phieu_muon=loan,
			ma_sach_trong_kho=borrowed_item,
			han_tra=today + timedelta(days=3),
		)

		fine_policy = ChinhSachPhat.objects.create(loai_phat='Mất sách', muc_den_bu_mat_sach=50000)
		KhoanPhat.objects.create(
			ma_nguoi_dung=reader,
			ma_phieu_muon=loan,
			ma_sach_trong_kho=overdue_item,
			ma_loai_phat=fine_policy,
			so_tien=50000,
			trang_thai_tt='Chưa thanh toán',
		)
		KhoanPhat.objects.create(
			ma_nguoi_dung=reader,
			ma_phieu_muon=loan,
			ma_sach_trong_kho=borrowed_item,
			ma_loai_phat=fine_policy,
			so_tien=20000,
			trang_thai_tt='Đã thanh toán',
		)

		self.client.force_login(admin_user)
		response = self.client.get(reverse('dashboard'))
		self.assertEqual(response.status_code, 200)

		self.assertEqual(response.context['total_books'], 4)
		self.assertEqual(response.context['available_books'], 2)
		self.assertEqual(response.context['borrowed_books'], 2)
		self.assertEqual(response.context['total_readers'], 2)
		self.assertEqual(response.context['active_readers'], 1)
		self.assertEqual(response.context['overdue_slips'], 1)
		self.assertEqual(int(response.context['unpaid_fines']), 50000)

		chart_data = response.context['dashboard_chart_data']
		self.assertEqual(chart_data['books_status']['data'], [2, 2])
		self.assertEqual(chart_data['readers']['data'], [1, 1])
		self.assertEqual(len(chart_data['overdue']['labels']), 7)
