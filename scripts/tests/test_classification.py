import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalog_sources.classification import spectral_labels


class SpectralSubtypeTests(unittest.TestCase):
    def labels(self, spectrum, object_type="star"):
        return spectral_labels({"type": object_type, "spectral_type": spectrum})

    def test_explicit_component_classes_include_ranges_and_peculiar_spectra(self):
        for spectrum, label in [("B2.5V", "Main-sequence"), ("B1-3V", "Main-sequence"),
                                ("kA4hF2VmF3", "Main-sequence"), ("M5/6IIIe", "Giant"),
                                ("kA0hA3(IV)SiSr", "Subgiant"), ("G8II", "Bright giant"),
                                ("M1.5Iab", "Supergiant"), ("M2VI", "Subdwarf"),
                                ("G8III-IIIb", "Giant"), ("K1-IIIFe-0.5", "Giant"),
                                ("A1mIV", "Subgiant"), ("G8+II", "Bright giant"),
                                ("B0.5Ia+", "Supergiant"), ("O4If+", "Supergiant")]:
            with self.subTest(spectrum=spectrum):
                self.assertEqual(self.labels(spectrum), [label])

    def test_unknown_composite_and_ambiguous_classes_do_not_invent_a_subtype(self):
        for spectrum in [None, "", "M3.5", "A7.5", "B9", "F5IV-V", "K1III-IV", "G8II/III",
                         "G9III+A7.5", "B2IV+", "A2VII"]:
            with self.subTest(spectrum=spectrum):
                self.assertEqual(self.labels(spectrum), [])

    def test_tentative_and_nonstellar_spectra_keep_their_scope(self):
        self.assertEqual(self.labels("K0V?"), ["Main-sequence candidate"])
        self.assertEqual(self.labels("A2-III:"), ["Giant candidate"])
        self.assertEqual(self.labels("T6.5", "brown_dwarf"), ["T-type"])
        self.assertEqual(self.labels("DA1.6", "white_dwarf"), [])


if __name__ == "__main__":
    unittest.main()
