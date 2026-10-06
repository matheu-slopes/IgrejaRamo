import unittest
import hq_worker


class WorkerFailureTests(unittest.TestCase):
    def test_upload_error_is_classified_from_exception_even_when_task_succeeded(self):
        error = RuntimeError('API HQ HTTP 502: Cloudflare R2 não está configurado')
        self.assertEqual(hq_worker.failure_code(error, 'HQ_PROGRESS={"progress":90}'), 'r2_access')

    def test_dependency_error_is_classified_from_task_log(self):
        self.assertEqual(hq_worker.failure_code(RuntimeError('Task failed'),
            "ModuleNotFoundError: No module named 'audio_separator'"), 'missing_dependency')

    def test_unknown_errors_remain_generic(self):
        self.assertEqual(hq_worker.failure_code(RuntimeError('Unknown'), ''), 'unknown')

    def test_quota_errors_do_not_masquerade_as_r2_configuration_errors(self):
        error = RuntimeError('API HQ HTTP 409: Limite seguro de 8 GB do Studio: 0.10 GB livres')
        self.assertEqual(hq_worker.failure_code(error, ''), 'storage_quota')


if __name__ == '__main__':
    unittest.main()
