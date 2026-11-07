import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from catalog_sources.classification import contradicted, spectral_labels


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


class ContradictedSubtypeTests(unittest.TestCase):
    def test_classes_ruled_out_by_type_spectrum_or_luminosity_are_withheld(self):
        for label, row in [
            ("Carbon star", {"type": "brown_dwarf", "spectral_type": "L2+L3.5"}),
            ("Cataclysmic variable", {"type": "white_dwarf", "spectral_type": "DAs"}),
            ("Red giant", {"type": "star", "spectral_type": "G0V"}),
            ("Red giant", {"type": "star", "spectral_type": "F5IV-V"}),
            ("S-type star", {"type": "star", "spectral_type": "sdM3.5"}),
            ("S-type star", {"type": "star", "spectral_type": "M4e", "absolute_mag": "14.2"}),
            ("Chemically peculiar", {"type": "star", "spectral_type": "M5V"}),
            ("Delta Scuti variable", {"type": "star", "spectral_type": "M5"}),
            ("Herbig Ae/Be", {"type": "star", "spectral_type": "G0V+"}),
            ("T Tauri", {"type": "star", "spectral_type": "K0V"}),
            ("Symbiotic star candidate", {"type": "star", "spectral_type": "", "luminosity_solar": "0.01"}),
            ("Hot subdwarf candidate", {"type": "star", "spectral_type": "A1Vn", "absolute_mag": "1.36"}),
            ("Classical Cepheid", {"type": "star", "spectral_type": "B8V"}),
        ]:
            with self.subTest(label=label, row=row):
                self.assertTrue(contradicted(label, row))

    def test_compatible_composite_or_undetermined_classes_are_kept(self):
        for label, row in [
            ("Pulsating variable", {"type": "white_dwarf", "spectral_type": "DA4.1"}),
            ("Red giant", {"type": "star", "spectral_type": "K1.5IIIFe-0.5"}),
            ("Long-period variable", {"type": "star", "spectral_type": "K9Ia+B2V"}),
            ("Delta Scuti variable", {"type": "star", "spectral_type": "A7Vn"}),
            ("Chemically peculiar", {"type": "star", "spectral_type": "B8Vne"}),
            ("T Tauri", {"type": "star", "spectral_type": "M2"}),
            ("Young stellar object", {"type": "star", "spectral_type": "M1.5V"}),
            ("Orion variable", {"type": "star", "spectral_type": "A0V"}),
            ("Red giant", {"type": "star", "spectral_type": "K1IV"}),
            ("Red giant", {"type": "star", "spectral_type": "G6/8V", "absolute_mag": "0.70"}),
        ]:
            with self.subTest(label=label, row=row):
                self.assertFalse(contradicted(label, row))


if __name__ == "__main__":
    unittest.main()
