J/MNRAS/527/8687    40 parsec sample of white dwarfs from Gaia  (O'Brien+, 2024)
================================================================================
The 40 parsec sample of white dwarfs from Gaia.
    O'Brien M.W., Tremblay P.-E., Klein B.L., Koester D., Melis C., Bedard A.,
    Cukanovaite E., Cunningham T., Doyle A.E., Gansicke B.T.,
    Gentile Fusillo N.P., Hollands M.A., McCleery J., Pelisoli I., Toonen S.,
    Weinberger A.J., Zuckerman B.
    <Mon. Not. R. Astron. Soc. 527, 8687 (2024)>
    =2024MNRAS.527.8687O        (SIMBAD/NED BibCode)
================================================================================
ADC_Keywords: Stars, white dwarf ; Stars, nearby ; Spectral types ; Optical
Keywords: stars: statistics - white dwarfs - solar neighbourhood

Abstract:
    We present a comprehensive overview of a volume-complete sample of
    white dwarfs located within 40 pc of the Sun, a significant proportion
    of which were detected in Gaia Data Release 3 (DR3). Our DR3 sample
    contains 1073 spectroscopically confirmed white dwarfs, with just 8
    candidates within our volume remaining unconfirmed (99.3 per cent
    spectroscopic completeness). Additionally, 28 white dwarfs were not in
    our initial selection from Gaia DR3, most of which are in unresolved
    binaries. We use Gaia DR3 photometry and astrometry to determine a
    uniform set of white dwarf parameters, including mass, effective
    temperature, and cooling age. We assess the demographics of the 40 pc
    sample, specifically magnetic fields, binarity, space density and mass
    and age distributions.

Description:
    Table A1 presents all confirmed white dwarfs within 40pc of the Sun,
    with accurate photometric parameters as well as spectral types and
    references.
    Table A6 is a wide binary catalogue with all wide binaries within 40pc
    that contain at least one white dwarf.

File Summary:
--------------------------------------------------------------------------------
 FileName    Lrecl  Records  Explanations
--------------------------------------------------------------------------------
ReadMe          80        .  This file
tablea1.dat    368     1078  All confirmed white dwarfs within 40pc of the Sun
                              (updated version, 14/11/2024)
tablea6.dat    394      129  Wide binary catalogue with all wide binaries within
                              40pc that contain at least one white dwarf
--------------------------------------------------------------------------------

See also:
   I/355 : Gaia DR3 Part 1. Main source (Gaia Collaboration, 2022)

   J/MNRAS/497/130  : Gaia white dwarfs within 40pc. I (Tremblay+, 2020)
   J/MNRAS/499/1890 : Gaia white dwarfs within 40pc. II (McCleery+, 2020)
   J/MNRAS/518/3055 : Gaia white dwarfs within 40pc. III (O'Brien+, 2023)

Byte-by-byte Description of file: tablea1.dat
--------------------------------------------------------------------------------
   Bytes Format Units     Label     Explanations
--------------------------------------------------------------------------------
   1- 22  A22   ---       Name      WDJ name (WDJHHMMSS.SS+DDMMSS.s) (WDJ_Name)
  24- 42  I19   ---       GaiaDR3   Gaia DR3 ID (DR3_source_id)
  44- 62 F19.15 mas       Plx       Parallax (parallax)
  64- 74  F11.9 mas     e_Plx       Parallax error (parallax_error)
  76- 95 F20.16 deg       RAdeg     Right Ascension (ICRS) at Ep=2016.0 (ra)
  97-108 F12.10 mas     e_RAdeg     Right Ascension error (ra_error)
 110-122  F13.9 deg       DEdeg     Declination (ICRS) at Ep=2016.0 (dec)
 124-135 F12.10 mas     e_DEdeg     Declination error (dec_error)
 137-147  F11.8 mag       GMAG      Absolute Gaia G magnitude (absG)
 149-161 F13.10 mag       BP-RP     Gaia DR3 BP minus Gaia DR3 RP colour index
                                     (bp_rp)
 163-171  A9    ---       SpType    Spectral Type (SpT)
 173-174  A2    ---       Comp      [H He] Atmospheric Composition (comp)
 176-180  I5    K         Teff      ? Adopted Gaia DR3 effective temperature
                                     (gaia_teff)
 182-185  I4    K       e_Teff      ? Adopted Gaia DR3 effective temperature
                                     error (gaia_teff_err)
 187-192  F6.4  [cm/s2]   logg      ? Adopted Gaia DR3 surface gravity
                                     (gaia_logg)
 194-198  F5.4  [cm/s2] e_logg      ? Adopted Gaia DR3 surface gravity error
                                     (gaia_logg_err)
 200-205  F6.4  Msun      Mass      ? Adopted Gaia DR3 mass (gaia_mass)
 207-211  F5.4  Msun    e_Mass      ? Adopted Gaia DR3 mass error
                                     (gaia_mass_err)
 213-217  I5    K         Teffc     ? Effective temperature after low-mass
                                     correction (corrected_teff)
 219-223  F5.3  K         Massc     ? Mass after low-mass correction
                                     (corrected_mass)
 225-229  F5.2  Gyr       Agec      ? Cooling age after low-mass correction
                                     (corrected_age)
 231-249  A19   ---     r_SpType    Reference paper for spectral type (bibcode)
 251-368  A118  ---       Com       Additional Comment (comment)
--------------------------------------------------------------------------------

Byte-by-byte Description of file: tablea6.dat
--------------------------------------------------------------------------------
   Bytes Format Units   Label        Explanations
--------------------------------------------------------------------------------
   1-  8  A8    ---     BinType      [WD MS BD] Type of binary (binary_type)
  10- 28  I19   ---     GaiaDR3-Id1  Gaia DR3 ID of white dwarf (dr3_source_id1)
  30- 48  I19   ---     GaiaDR3-Id2  ? Gaia DR3 ID of first companion
                                      (dr3_source_id2)
  50- 68  I19   ---     GaiaDR3-Id3  ? Gaia DR3 ID of second companion
                                      (dr3_source_id3)
  70- 91  A22   ---     Name1        Name of white dwarf (name_1)
  93-117  A25   ---     Name2        Name of companion (name_2)
 119-135  A17   ---     Name3        Name of second companion (name_3)
 137-142  A6    ---     SpType1      Spectral type of white dwarf (SpT_1)
 144-162  A19   ---   r_SpType1      Reference paper for spectral type of
                                      white dwarf (SpT_bibcode_1)
 164-171  A8    ---     SpType2      Spectral type of companion (SpT_2)
 173-191  A19   ---   r_SpType2      Reference paper for spectral type of
                                      first companion (SpT_bibcode_2)
 193-199  A7    ---     SpType3      Spectral type of second companion (SpT_3)
 201-219  A19   ---   r_SpType3      Reference paper for spectral type of
                                      second companion (SpT_bibcode_3)
 221-232  F12.8 mas     Plx          Parallax in mas (wd_parallax)
 234-248 F15.13 pc      Sep1pc       ? Projected separation between white dwarf
                                      and first companion in pc
                                      (projected_separation_1_pc)
 250-264  F15.8 AU      Sep1AU       ? Projected separation between white dwarf
                                      and first companion in AU
                                      (projected_separation_1_AU)
 266-278 F13.11 km/s    dvtan1       ? Tangential velocity difference between
                                      white dwarf and first companion
                                      (delta_vtan_1)
 280-293 F14.12 pc      Sep2pc       ? Projected separation between white dwarf
                                      and second companion in pc
                                      (projected_separation_2_pc)
 295-306  F12.7 AU      Sep2AU       ? Projected separation between white dwarf
                                      and second companion in AU
                                      (projected_separation_2_AU)
 308-319 F12.10 km/s    dvtan2       ? Tangential velocity difference between
                                      white dwarf and second companion
                                      (delta_vtan_2)
 321-394  A74   ---     Comment      Additional comment (comment)
--------------------------------------------------------------------------------

Acknowledgements:
    Mairi O'Brien, mairi.obrien1(at)gmail.com

History:
    05-Jan-2024: on-line version
    18-Apr-2024: Agec taken-off in tablea1 from author request
    14-Nov-2024: Agec added in tablea1 from author

================================================================================
(End)                                        Patricia Vannier [CDS]  11-Sep-2023
