from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from quan_ly_nguoi_dung.models import NguoiDung


class ReaderAccessControlTests(TestCase):
	def setUp(self):
		self.password = '123456@abc'
		self.user = User.objects.create_user(username='DG0001', password=self.password)
		self.reader = NguoiDung.objects.create(
			ma_nguoi_dung='DG0001',
			user=self.user,
			loai_nguoi_dung='doc_gia',
			ho_ten='Doc Gia Test',
		)

	def test_reader_login_redirects_to_borrow_page(self):
		response = self.client.post(
			reverse('login'),
			{'username': self.user.username, 'password': self.password},
		)
		self.assertRedirects(response, reverse('borrow_list'))

	def test_reader_cannot_access_dashboard_directly(self):
		self.client.login(username=self.user.username, password=self.password)
		response = self.client.get(reverse('dashboard'))
		self.assertRedirects(response, reverse('borrow_list'))

	def test_reader_can_open_borrow_page_and_list_api(self):
		self.client.login(username=self.user.username, password=self.password)
		page_response = self.client.get(reverse('borrow_list'))
		self.assertEqual(page_response.status_code, 200)

		api_response = self.client.get(reverse('api_get_borrow_list'))
		self.assertEqual(api_response.status_code, 200)

