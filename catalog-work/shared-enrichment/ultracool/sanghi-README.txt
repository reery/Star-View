---------------------------------------------------
Table of Fundamental Properties Column Descriptions
---------------------------------------------------

(1) 'name': Unique object name (normally taken from the object's first publication)

(2) 'name_simbadable': SIMBAD-able name

(3) 'ref_discovery': Reference of discovery of the object as an ultracool dwarf. Papers that identified a particular object as a photometric candidate prior to confirmation are noted with a 'phot' keyword before the reference.

(4) 'flag': Flags with target info - see below for details

(5) 'ref_flag': References for flags with target info

(6) 'age_category': Category assigned to the object regarding its age estimate, based on the approach described in Section 6 of Sanghi et al. (2023, ApJ, in press). In brief:
- BANYAN Sigma is used with the UCS astrometry to assess moving group membership. Objects with >=90% membership probability are assigned to the group, with the string used in BANYAN Sigma (BPMG = beta Pic moving group, etc.) and a '!' appended to the string if full 6-d kinematic information is available (parallax, proper motion & RV). Objects with membership probability of 80-90% are assigned to the group, with a '?' appended, which is also appended for objects whose memberships rely on photometric distances or whose spectroscopic gravities are in conflict with such membership (FLD-G objects in <100 Myr moving groups).
- Objects with field membership assigned by BANYAN Sigma but with low-gravity spectra are assigned to the age category corresponding to their gravity classification.   
- If there is an age estimate for the object on the basis of it belonging to the stellar multiple (i.e. it's a companion to a higher mass star or in a binary system), then the name of the object is given here.
- If there is ancillary age information in the literature in the flag column, this is considered as well, which can lead to the outcome which is in accord with the BANYAN Sigma information or in discord (which can lead to a '?' designation or not, based on a judgment call).
- Finally, all the strings in this column correspond to entries in the 'AgeValues.csv' file, which gives the associated ages, uncertainties & references.

(7) 'age_category_justification': Justification for the assigned age_category value.  
- 'UCS+BANYAN' means assignment based on our BANYAN Sigma calculations using the UltracoolSheet astrometry. (For objects that are placed in YMGs using old-objects photometric distances but whose memberships are not upheld using young-object photometric distances, these are assigned field membership and flagged with 'UCS_23(dphot)' to highlight the inconsistency in the photometric distances.)
- Citations are provided for objects with other memberships or spectroscopic gravities.   
- 'system_age' is listed for objects with individual age determinations (which are tabulated & cited in the 'AgeValues.csv' file).   
- 'UCS_23' means we needed to make a judgment call to reconcile multiple pieces of info (or no info at all).  
- Note that for objects in star-forming regions (esp. USCO), we sometimes defer to the literature membership even when not fully supported by the BANYAN Sigma results, since we did not do a complete examination of the literature associated with objects in these regions.  A more careful look at membership for these objects is warranted, beyond our large-scale analysis here.

(8) 'ra_j2000_formula' (deg): Final adopted Right Ascension (equinox=2000, epoch=2000); preference order is ra_j2000_DR3/DR2 (includes both objects detected in DR3 and companions' host stars when their separations are < 1 arcsec or there are no other coordinates available for the companion), ra_j2000_PS1 (only if object is detected in PS1), ra_j2000_CatWISE (only if the object is detected and has measured proper motion in CatWISE), ra_j2000_UKIDSS (only if the object is detected and has measured proper motion in UKIDSS), and finally ra_j2000_SIMBAD (with hyperlink to the coordinates reference).  For ra_j2000_UKIDSS and ra_j2000_P1, the epoch 2000 coordinates given here were computed by us from the observing epoch and the proper motions reported in those catalogs.  (These proper motions are not necessarily the same as the best possible proper motions). (See UltracoolSheet v2.0 for referenced columns).

(9) 'dec_j2000_formula'	(deg): Final adopted Declination (equinox=2000, epoch=2000); follows the same preference order as ra_j2000_formula

(10) 'source_j2000_formula': Source of the RA and Dec given in ra_j2000_formula and dec_j2000_formula: DR3/DR2, CatWISE, UKIDSS, PS1, or SIMBAD.

(11) 'designation_P1_formula': Pan-STARRS1 3π Survey DR2 designation, auto-generated from the PS1 DR2 coordinates. (Some objects with a designation were detected by Pan-STARRS1 but the photometry is of insufficent quality to appear in this table; see Best et al. 2018).

(12) 'g_P1' (mag): g-band photometry from Pan-STARRS1

(13) 'gerr_P1' (mag): Uncertainty in g-band photometry from Pan-STARRS1. A value of -999 denotes robust PS1 detection for a companion but contaminated/unreliable photometry due to the brighter host star.

(14) 'ref_g_P1': Reference for Pan-STARRS1 g-band photometry

(15) 'r_P1' (mag): r-band photometry from Pan-STARRS1

(16) 'rerr_P1' (mag): Uncertainty in r-band photometry from Pan-STARRS1. A value of -999 denotes robust PS1 detection for a companion but contaminated/unreliable photometry due to the brighter host star.

(17) 'ref_r_P1': Reference for Pan-STARRS1 r-band photometry

(18) 'i_P1' (mag): i-band photometry from Pan-STARRS1

(19) 'ierr_P1' (mag): Uncertainty in i-band photometry from Pan-STARRS1. A value of -999 denotes robust PS1 detection for a companion but contaminated/unreliable photometry due to the brighter host star.

(20) 'ref_i_P1': Reference for Pan-STARRS1 i-band photometry

(21) 'z_P1' (mag): z-band photometry from Pan-STARRS1

(22) 'zerr_P1' (mag): Uncertainty in z-band photometry from Pan-STARRS1. A value of -999 denotes robust PS1 detection for a companion but contaminated/unreliable photometry due to the brighter host star.

(23) 'ref_z_P1': Reference for Pan-STARRS1 z-band photometry

(24) 'y_P1' (mag): y-band photometry from Pan-STARRS1

(25) 'yerr_P1' (mag): Uncertainty in y-band photometry from Pan-STARRS1. A value of -999 denotes robust PS1 detection for a companion but contaminated/unreliable photometry due to the brighter host star.

(26) 'ref_y_P1': Reference for Pan-STARRS1 y-band photometry

(27) 'designation_2mass': 2MASS designation

(28) 'J_2MASS' (mag): J-band photometry from 2MASS

(29) 'Jerr_2MASS' (mag): Uncertainty in J-band photometry from 2MASS. NaN indicates that J_2MASS is an upper limit.

(30) 'ref_J_2MASS': Reference for 2MASS J-band photometry

(31) 'H_2MASS' (mag): H-band photometry from 2MASS

(32) 'Herr_2MASS' (mag): Uncertainty in H-band photometry from 2MASS. NaN indicates that H_2MASS is an upper limit.

(33) 'ref_H_2MASS': Reference for 2MASS H-band photometry

(34) 'Ks_2MASS' (mag): Ks-band photometry from 2MASS. Contains a handful of Ks magnitudes from instruments other than the 2MASS cameras.

(35) 'Kserr_2MASS' (mag): Uncertainty in Ks-band photometry from 2MASS. NaN indicates that Ks_2MASS is an upper limit. Contains a handful of Ks magnitude uncertainties from instruments other than the 2MASS cameras.

(36) 'ref_Ks_2MASS': Reference for 2MASS Ks-band photometry

(37) 'designation_ukidss': UKIDSS designation

(38) 'J_ukidss' (mag): J-band photomtery from UKIDSS DR11 (LAS: "j/j_1/j_2apermag3" with the lowest error; other surveys: "japermag3"). Note that some saturated data have been removed from here (set to NaN), but a thorough removal has not been done yet.

(39) 'Jerr_ukidss' (mag): Uncertainty in J_ukidss

(40) 'H_ukidss' (mag): H-band photomtery from UKIDSS DR11 (all surveys: "hapermag3"). Note that some saturated data have been removed from here (set to NaN), but a thorough removal has not been done yet.

(41) 'Herr_ukidss' (mag): Uncertainty in H_ukidss

(42) 'K_ukidss' (mag): K-band photometry from UKIDSS DR11 (GPS and GCS: "k/k_1/k_2apermag3" with the lowest error; other surveys: "kapermag3").  Note that some saturated data have been removed from here (set to NaN), but a thorough removal has not been done yet.

(43) 'Kerr_ukidss' (mag): Uncertainty in K_ukidss

(44) 'J_MKO' (mag): J-band photometry in MKO system

(45) 'Jerr_MKO' (mag): Uncertainty in J-band photometry in MKO system. NaN indicates that J_MKO is an upper limit.

(46) 'ref_J_MKO': Reference for J-band photometry in MKO system

(47) 'H_MKO' (mag): H-band photometry in MKO system

(48) 'Herr_MKO' (mag): Uncertainty in H-band photometry in MKO system. NaN indicates that H_MKO is an upper limit.

(49) 'ref_H_MKO': Reference for H-band photometry in MKO system

(50) 'K_MKO' (mag): K-band photometry in MKO system

(51) 'Kerr_MKO' (mag): Uncertainty in K-band photometry in MKO system. NaN indicates that K_MKO is an upper limit.

(52) 'ref_K_MKO': Reference for K-band photometry in MKO system

(53) 'designation_WISE': CatWISE2020 designation if available, else AllWISE designation

(54) 'W1': (mag): W1-band photometry from CatWISE (w1mpro) if available, else AllWISE

(55) 'W1err' (mag): Uncertainty in W1-band photometry. NaN indicates that W1 is an upper limit.

(56) 'ref_W1': Reference for W1 photometry

(57) 'W2' (mag): W2-band photometry from CatWISE (w2mpro) if available, else AllWISE

(58) 'W2err' (mag): Uncertainty in W2-band photometry. NaN indicates that W2 is an upper limit.

(59) 'ref_W2': Reference for W2 photometry

(60) 'W3' (mag): W3-band photometry from AllWISE

(61) 'W3err' (mag): Uncertainty in W3-band photometry. NaN indicates that W3 is an upper limit.

(62) 'ref_W3': Reference for W3 photometry

(63) 'W4' (mag): W4-band photometry from AllWISE

(64) 'W4err' (mag): Uncertainty in W4-band photometry. NaN indicates that W4 is an upper limit.

(65) 'ref_W4': Reference for W4 photometry

(66) 'ch1' (mag): Spitzer [3.6]-band photometry

(67) 'ch1err' (mag): Uncertainty in Spitzer [3.6]-band photometry

(68) 'ch2' (mag): Spitzer [4.5]-band photometry

(69) 'ch2err' (mag): Uncertainty in Spitzer [4.5]-band photometry

(70) 'ref_Spitzer': Reference for Spitzer photometry

(71) 'plx_formula' (mas): Final adopted parallax; preference order is plx_DR3/DR2, then the most precise of [plx_lit, plx_UKIRT, plx_P1], excluding plx_P1 measurements with plx_P1/eplx_P1 < 5. (See UltracoolSheet v2.0 for referenced columns).

(72) 'plxerr_formula' (mas): Uncertainty in plx_formula

(73) 'ref_plx_formula': Reference for adopted parallax

(74) 'grav_opt': Optical gravity classification: beta, gamma, delta for increasingly low gravity

(75) 'ref_grav_opt': Reference for grav_opt

(76) 'grav_ir': NIR gravity classification: FLD-G, INT-G, VL-G; or beta, gamma, delta

(77) 'ref_grav_ir': Reference for grav_ir

(78) 'spt_opt': Optical spectral type classification (uncertainties are assumed to be 0.5 subtypes, an appended ":" implies an uncertainty of 1 subtype, and an appended "::" implies an uncertainty of 2 subtype)

(79) 'ref_spt_opt': Reference for spt_opt

(80) 'spt_ir': NIR spectral type classification (uncertainties are assumed to be 0.5 subtypes, an appended ":" implies an uncertainty of 1 subtype, and an appended "::" implies an uncertainty of 2 subtype)

(81) 'ref_spt_ir': Reference for spt_ir

(82) 'sptnum_opt_formula': Numerical optical spectral type (M6=6, L0=10, T0=20; negative numbers indicate subdwarfs)

(83) 'sptnum_ir_formula': Numerical NIR spectral type (M6=6, L0=10, T0=20; negative numbers indicate subdwarfs)

(84) 'sptnum_formula': Adopted numerical spectral type (when both optical and NIR types are available, chooses optical types for M and L dwarfs and NIR types for T dwarfs)

(85) 'dist_formula' (pc): Adopted distance. Preference order = plx, W2, K (if sptnum_formula<24.5), J (if sptnum_formula>=24.5); if both 2MASS and MKO photometry are available in K or J band, use 2MASS. Photometric distances of binaries use the resolved photometry for the primary component.

(86) 'disterr_formula' (pc): Uncertainty in dist_formula

(87) 'dist_formula_source': Source of the values in the dist_formula and disterr_formula columns. If the distance was computed using a SpT vs. photometry polynomial for young objects, then "_young" is appended. If there is no distance given in dist_formula, then "null_no_phot" indicates no photometry available in any of the bands used in in the dist_*_formula columns; "null_no_spt" indicates no spectral type available to compute a photometric distance, and "null_binary_no_spt" indicates no resolved spectral type available for the primary of a binary system.

(88) 'spex_slit_size' (arcsec): IRTF/SpeX slit size used to collect the object's SpeX Prism spectra

(89) spex_prism_snr: Median signal-to-noise ratio (S/N) of the SpeX Prism spectrum for the standard IR bandpasses and also for two wavelength regions free of methane absorption (H_blue = 1.49–1.63 microns and K_blue = 2.03–2.20 microns), which are relevant for T-dwarf spectra. The S/N are presented in the following order: Y, J, H, H_blue, K, K_blue

(90) 'spex_prism_ref': Reference for the object's SpeX Prism spectrum

(91) 'best_fit_atmo_model_name': Atmospheric model that best fits an object's optical to mid-infrared spectral energy distribution. (See Section 4 of Sanghi et al. 2023, ApJ, in press).

(92) 'reduced_chi2_best_fit': Reduced chi-square for the best-fit atmospheric model spectrum to an objects optical to mid-infrared spectral energy distribution.

(93) 'teff_atmo' (K): Atmospheric model-derived effective temperature

(94) 'radius_atmo' (Rjup): Atmospheric model-derived radius

(95) 'logg_atmo' (dex): Atmospheric model-derived surface gravity

(96) 'log_lbol_lsun' (dex): Bolometric luminosity

(97) 'log_lbol_lsun_err' (dex): Uncertainty in bolometric luminosity

(98) 'lbol_flag' (bool): TRUE for objects with reduced_chi2_best_fit > 50. (See Section 5.2 of Sanghi et al. 2023, ApJ, in press).

(99) 'evo_model_name': Evolutionary model used to estimate fundamental parameters using Bayesian rejection sampling. (See Section 7 of Sanghi et al. 2023, ApJ, in press)

(100) 'teff_evo' (K): Evolutionary model-derived effective temperature

(101) 'teff_evo_err' (K): Uncertainty in the evolutionary model-derived effective temperature

(102) 'radius_evo' (Rjup): Evolutionary model-derived radius

(103) 'radius_evo_err' (Rjup): Uncertainty in the evolutionary model-derived radius

(104) 'mass_evo' (Mjup): Evolutionary model-derived mass

(105) 'mass_evo_err' (Mjup): Uncertainty in the evolutionary model-derived mass

(106) 'logg_evo' (dex): Evolutionary model-derived surface gravity

(107) 'logg_evo_err' (dex): Uncertainty in the evolutionary model-derived surface gravity

------------------------------
AgeValues Column Descriptions
------------------------------
(1) 'name': Name of age determination method

(2) 'age_type':	Broad categories for age determination methods. The string in this column directly cross-matches to values in the 'age_category' column of the associated 'Ultracool_Fundamental_Properties_Table.csv' file (see below for details).

(3) 'age_Gyr' (Gyr): Mean age of the object (does not necessarily correspond to a Gaussian age distribution)

(4) 'age_upp_err' (Gyr): Upper error bar on the age of the object (does not necessarily correspond to a Gaussian age distribution)

(5) 'age_low_err' (Gyr): Lower error bar on the age of the object (does not necessarily correspond to a Gaussian age distribution)

(6) 'age_range_type': Identifies the distribution (normal, uniform, non-Gaussian) applicable for the quoted age range. In particular, Field and FLD-G objects use non-Gaussian distributions that cannot be represented accurately by the values in the previous three columns. Refer to Section 6 in Sanghi et al. (2023, ApJ, in press) for more information.

(7) 'age_ref': Reference for the age range

------------------------------
References Column Descriptions
------------------------------
(1) 'code_ref': A unique code used to represent a publication. code_ref is used in the columns having names starting with "ref_" in the other tabs of this spreadsheet.  The format is AAAAYYn, where AAAA are the first 4 letters of the first author's last name (if there are fewer than 4 letters, then "_" is used to fill out the rest of the 4-letter string), YY are the last two digits of the publication year, and n indicates multiple publications from author(s) AAAA in YY.

(2) 'ADSkey_ref': The ADS key corresponding to this publication

(3) 'Paperskey_ref': The "universal" citekey (originally generated by the Papers app) corresponding to this publication

(4) 'citetext_ref': Plain language of the citation in the format Lastname, et al. (YYYY); i.e., same as \citet{} in bibtex parlance

(5) 'title_ref': Title of the publication (may include some LaTeX)

--------------------------------
'flag' Column Entry Descriptions
--------------------------------
Any of the following flags can be appended with a "?" to indicate that there is some uncertainty in the associated property		

'ABDor': member of the AB Doradus moving group
'Argus': member of the Argus moving group
'binary?': suspected binary but not confirmed
'BPMG': member of the beta Pictoris moving group
'CarNear': member of the Carina Near association
'ChaI': member of the Chameleon I star-forming region
'ChaII': member of the Chameleon II star-forming region
'Columba': member of the Columba moving group
'HyadMG': member of the Hyades stream (not the cluster)
'Hyades': member of the Hyades star cluster
'IC348': member of IC 348 star-forming region
'LCC': member of the Lower Centaurus Crux star-forming region
'Li': displays Li I absorption at 6708 Å
'LkHa233': member of the LkHa 233 group
'Lupus': member of the Lupus star-forming region
'Oph': member of the Ophiuchus Region 
'Orion': member of the Orion Nebula
'Pleiades': member of the Pleiades cluster
'PleiadMG': member of the Pleiades stream (not the cluster)
'RCrA': member of the R CrA cluster (a.k.a. Coronet cluster)
'Sco-Cen': member of the Scorpius-Centaurus star-forming complex
'SOri': member of the Sigma Ori star-forming region
'Taurus': member of the Taurus Complex
'TWA': member of the TW Hya moving group
'Tuc-Hor': member of the Tuc-Hor moving group
'UCL': member of the Upper Centaurus Lupus star-forming region
'UMaMG': member of the Ursa Majoris stream (not the cluster)
'USco': member of the Upper Scorpius star-forming region
'accr': spectroscopic signature(s) of accretion
'disk': evidence of having a circumstellar disk
'lowZ': low metallicity, either from the object's spectrum or a stellar companion
'lowg': low surface gravity features noted in the literature
'over-L': overluminous for its spectral type; this includes both confirmed binaries and candidate binaries where this is the only evidence of multiplicity
'photSpT': object has only photometric spectral type(s), not spectroscopic 
'plx-discrep': parallax measurement is questioned in the literature due to an observed discrepancy 
'reddened': evidence for interstellar or circumstellar reddening 
'specblend': composite spectrum of two ultracool dwarf spectra matches better than single template
'strongHa': spectrum shows strong H-alpha emission
'subd': spectroscopically confirmed subdwarf
'triple': known to be a triple system 
'v-red': unusually red object for its spectral type 
'young': known young object, e.g., from age-dated companion that is likely ~300 Myr or younger; from membership in a young moving group; from lithium; etc.