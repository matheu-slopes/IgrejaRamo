import unittest
from unittest.mock import Mock, patch

from cifra_worker import fetch_cifra, parse_cifra_html


HTML = """
<html><body>
  <h1 class="t1">Tua Presença Vale Mais</h1>
  <h2 class="t3"><a>Mateus Brito</a></h2>
  <div>Tom: Bb (com forma de G)</div>
  <div>Capotraste: 3&#170; casa</div>
  <a href="/mateus-brito/tua-presenca-vale-mais/simplificada/">Simplificada</a>
  <div id="cifra_cnt"><pre>[Intro] C7M  D4

[Primeira Parte]
C7M
O Teu amor me constrange
D4
E me faz ser alguém melhor</pre></div>
  <script>{"youtubeID":"abcdefghijk"}</script>
</body></html>
"""


class CifraParserTests(unittest.TestCase):
    def test_extracts_key_shape_capo_youtube_and_versions(self):
        result = parse_cifra_html(HTML, "mateus-brito", "tua-presenca-vale-mais")
        self.assertEqual(result["name"], "Tua Presença Vale Mais")
        self.assertEqual(result["artist"], "Mateus Brito")
        self.assertEqual(result["tom_original"], "Bb")
        self.assertEqual(result["forma_da_cifra"], "G")
        self.assertEqual(result["capotraste"], "3\u00aa casa")
        self.assertEqual(result["youtube_url"], "https://www.youtube.com/watch?v=abcdefghijk")
        self.assertEqual(len(result["versoes"]), 2)
        self.assertGreater(len(result["cifra"]), 3)

    @patch("cifra_worker._fetch_with_browser", return_value=HTML)
    @patch("cifra_worker.requests.get")
    def test_uses_browser_when_direct_request_is_blocked(self, get: Mock, browser: Mock):
        get.return_value.status_code = 403
        result = fetch_cifra({
            "artista_slug": "mateus-brito",
            "musica_slug": "tua-presenca-vale-mais",
            "versao": "principal",
        })
        self.assertEqual(result["tom_original"], "Bb")
        browser.assert_called_once()



if __name__ == "__main__":
    unittest.main()
