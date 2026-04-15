# Electronics Parts — Tracked Production Lines

Construct: POIN Factory 25-08-18
ConstructId: 1002090
PlayerId: 10000

> Reorganized from electronics-parts.md per production line.
> Each line lists its output buffers, linked Transfer Units, and producer devices.

---

## Basic Component

- Product: `component_1` (item type `794666749`, recipe `1319718943`, unit volume `0.5`)
- Producer target: `21600` on medium S buffers, `2700` on direct XS outputs

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Bas Comp S1 FULL | 2008 | 12000 L | medium producer output |
| Bas Comp S2 | 2009 | 12000 L | medium producer output |
| Bas Comp S3 | 4762 | 12000 L | medium producer output |
| Bas Comp XS1 | 1972 | 1500 L | direct XS producer output |
| Bas Comp XS2 FULL | 1971 | 1500 L | direct XS producer output |
| Bas Comp XS3 FULL | 1970 | 1500 L | direct XS producer output |
| Bas Comp XS4 FULL | 1969 | 1500 L | direct XS producer output |
| Bas Comp XS5 FULL | 1968 | 1500 L | direct XS producer output |
| Bas Comp XS6 FULL | 1973 | 1500 L | direct XS producer output |
| Bas Comp XS7 | 1974 | 1500 L | direct XS producer output |
| Bas Comp XS8 | 1975 | 1500 L | direct XS producer output |
| Bas Comp XS9 FULL | 1976 | 1500 L | direct XS producer output |
| Bas Comp XS10 | 1977 | 1500 L | direct XS producer output |
| Bas Comp XS11 | 4592 | 1500 L | relay from S1 |
| Bas Comp XS12 | 4591 | 1500 L | relay from S1 |
| Bas Comp XS13 | 4590 | 1500 L | relay from S2 |
| Bas Comp XS14 | 4589 | 1500 L | relay from S2 |

### Transfer Units

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 4587 | TU Bas Comp XS12 | component_1 | Bas Comp S1 FULL → Bas Comp XS12 |
| 4588 | TU Bas Comp XS11 | component_1 | Bas Comp S1 FULL → Bas Comp XS11 |
| 4585 | TU Bas Comp XS14 | component_1 | Bas Comp S2 → Bas Comp XS14 |
| 4586 | TU Bas Comp XS13 | component_1 | Bas Comp S2 → Bas Comp XS13 |

### Producers

| Local Id | Name | Bank |
|----------|------|------|
| 1920 | Bas Comp S1 P1 | S1 |
| 1925 | Bas Comp S1 P2 | S1 |
| 1930 | Bas Comp S1 P3 | S1 |
| 2162 | Bas Comp S1 P4 | S1 |
| 1935 | Bas Comp S2 P1 | S2 |
| 1940 | Bas Comp S2 P2 | S2 |
| 4432 | Bas Comp S2 P3 | S2 |
| 4433 | Bas Comp S2 P4 | S2 |
| 4434 | Bas Comp S2 P5 | S2 |
| 4435 | Bas Comp S2 P6 | S2 |
| 4436 | Bas Comp S3 P1 | S3 |
| 4437 | Bas Comp S3 P2 | S3 |
| 4438 | Bas Comp S3 P3 | S3 |
| 2135 | Bas Comp XS1 P1 | XS1 |
| 2144 | Bas Comp XS1 P2 | XS1 |
| 2136 | Bas Comp XS2 P1 | XS2 |
| 2143 | Bas Comp XS2 P2 | XS2 |
| 2137 | Bas Comp XS3 P1 | XS3 |
| 2142 | Bas Comp XS3 P2 | XS3 |
| 2138 | Bas Comp XS4 P1 | XS4 |
| 2141 | Bas Comp XS4 P2 | XS4 |
| 2139 | Bas Comp XS5 P1 | XS5 |
| 2140 | Bas Comp XS5 P2 | XS5 |
| 1918 | Bas Comp XS6 P1 | XS6 |
| 1919 | Bas Comp XS6 P2 | XS6 |
| 1926 | Bas Comp XS7 P1 | XS7 |
| 1927 | Bas Comp XS7 P2 | XS7 |
| 1928 | Bas Comp XS8 P1 | XS8 |
| 1929 | Bas Comp XS8 P2 | XS8 |
| 1936 | Bas Comp XS9 P1 | XS9 |
| 1937 | Bas Comp XS9 P2 | XS9 |
| 1938 | Bas Comp XS10 P1 | XS10 |
| 1939 | Bas Comp XS10 P2 | XS10 |

---

## Basic Connector

- Product: `connector_1` (item type `2872711779`, recipe `1738589935`, unit volume `0.8`)
- Producer target: `13500` on medium S buffers, `1680` on direct XS outputs

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Bas Connect S1 | 2011 | 12000 L | medium producer output |
| Bas Connect S2 | 2010 | 12000 L | medium producer output |
| Bas Connect XS1 | 1982 | 1500 L | direct XS producer output |
| Bas Connect XS2 | 1981 | 1500 L | direct XS producer output |
| Bas Connect XS3 | 1980 | 1500 L | direct XS producer output |
| Bas Connect XS4 | 1979 | 1500 L | direct XS producer output |
| Bas Connect XS5 | 1978 | 1500 L | direct XS producer output |
| Bas Connect XS6 FULL | 1983 | 1500 L | direct XS producer output |
| Bas Connect XS7 FULL | 1984 | 1500 L | direct XS producer output |
| Bas Connect XS8 | 1985 | 1500 L | direct XS producer output |
| Bas Connect XS9 | 1986 | 1500 L | direct XS producer output |
| Bas Connect XS10 | 1987 | 1500 L | direct XS producer output |

### Transfer Units

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 2377 | TU Bas Connector | connector_1 | Bas Connect S1 → Unc Pwr Sys Support XS1 |
| 2983 | TU Unc Pwr XS2 BasConn | connector_1 | Bas Connect S1 → Unc Pwr Sys Support XS2 |
| 3307 | TU Bas Connector | connector_1 | Bas Connect S1 → Rare Pwr Sys Support 3 |
| 5699 | — | connector_1 | Bas Connect S1 → Rare Magnet Support XS1 |
| 3932 | — | connector_1 | Bas Connect S2 → Magnet Support XS1 FULL |
| 5224 | — | connector_1 | Bas Connect S2 → Unc Magnet Support XS2 |
| 5233 | — | connector_1 | Bas Connect S2 → Unc Magnet Support XS3 |
| 7707 | — | connector_1 | Bas Connect S2 → Rare Magnet Support XS3 |

### Producers

| Local Id | Name | Bank |
|----------|------|------|
| 1953 | Bas Connect S1 P1 | S1 |
| 1962 | Bas Connect S1 P2 | S1 |
| 1963 | Bas Connect S1 P3 | S1 |
| 1943 | Bas Connect S2 P1 | S2 |
| 1952 | Bas Connect S2 P2 | S2 |
| 1921 | Bas Connect XS1 P1 | XS1 |
| 1924 | Bas Connect XS2 P1 | XS2 |
| 1931 | Bas Connect XS3 P1 | XS3 |
| 1934 | Bas Connect XS4 P1 | XS4 |
| 1941 | Bas Connect XS5 P1 | XS5 |
| 1922 | Bas Connect XS6 P1 | XS6 |
| 1923 | Bas Connect XS7 P1 | XS7 |
| 1932 | Bas Connect XS8 P1 | XS8 |
| 1933 | Bas Connect XS9 P1 | XS9 |
| 1942 | Bas Connect XS10 P1 | XS10 |

---

## Uncommon Component

- Product: `component_2` (item type `794666748`, recipe `1319718942`, unit volume `0.5`)
- Producer target: `21600` on medium S buffers, `2700` on direct XS outputs

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Unc Comp S1 | 2012 | 12000 L | medium producer output |
| Unc Comp S2 | 2013 | 12000 L | medium producer output |
| Unc Comp B XS1 | 2002 | 1500 L | direct XS producer output |
| Unc Comp B XS2 | 2001 | 1500 L | direct XS producer output |
| Unc Comp B XS3 | 2000 | 1500 L | direct XS producer output |
| Unc Comp B XS4 | 1999 | 1500 L | direct XS producer output |
| Unc Comp B XS5 | 1998 | 1500 L | direct XS producer output |
| Unc Comp XS1 | 1992 | 1500 L | direct XS producer output |
| Unc Comp XS2 | 1991 | 1500 L | direct XS producer output |
| Unc Comp XS3 | 1990 | 1500 L | direct XS producer output |
| Unc Comp XS4 | 1989 | 1500 L | direct XS producer output |
| Unc Comp XS5 | 1988 | 1500 L | direct XS producer output |
| Unc Comp XS6 FULL | 1993 | 1500 L | direct XS producer output |
| Unc Comp XS7 | 1994 | 1500 L | direct XS producer output |
| Unc Comp XS8 | 1995 | 1500 L | direct XS producer output |
| Unc Comp XS9 | 1996 | 1500 L | direct XS producer output |
| Unc Comp XS10 | 1997 | 1500 L | direct XS producer output |
| Unc Comp XS3 (relay) | 8053 | 1500 L | relay — not a producer, fed by TU 8051 from Unc Comp B XS4 |

### Transfer Units

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 8051 | TU Unc Comp XS3 | component_2 | Unc Comp B XS4 → Unc Comp XS3 (relay 8053) |

### Producers

| Local Id | Name | Bank |
|----------|------|------|
| 1956 | Unc Comp S1 P1 | S1 |
| 1959 | Unc Comp S1 P2 | S1 |
| 1966 | Unc Comp S1 P3 | S1 |
| 1946 | Unc Comp S2 P1 | S2 |
| 1949 | Unc Comp S2 P2 | S2 |
| 1967 | Unc Comp B XS1 P1 | B XS1 |
| 1958 | Unc Comp B XS2 P1 | B XS2 |
| 1957 | Unc Comp B XS3 P1 | B XS3 |
| 1948 | Unc Comp B XS4 P1 | B XS4 |
| 1947 | Unc Comp B XS5 P1 | B XS5 |
| 1964 | Unc Comp XS1 P1 | XS1 |
| 1961 | Unc Comp XS2 P1 | XS2 |
| 1954 | Unc Comp XS3 P1 | XS3 |
| 1951 | Unc Comp XS4 P1 | XS4 |
| 1944 | Unc Comp XS5 P1 | XS5 |
| 1965 | Unc Comp XS6 P1 | XS6 |
| 1960 | Unc Comp XS7 P1 | XS7 |
| 1955 | Unc Comp XS8 P1 | XS8 |
| 1950 | Unc Comp XS9 P1 | XS9 |
| 1945 | Unc Comp XS10 P1 | XS10 |

---

## Uncommon Connector

- Product: `connector_2` (item type `2872711778`, recipe `1738589934`, unit volume `0.8`)
- Producer target: `13500` on medium S buffers, `1680` on direct XS outputs

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Unc Connector XS1 | 2003 | 1500 L | direct XS producer output |
| Unc Connector XS2 | 2004 | 1500 L | direct XS producer output |
| Unc Connector XS3 | 2005 | 1500 L | direct XS producer output |
| Unc Connector XS4 | 2006 | 1500 L | direct XS producer output |
| Unc Connector XS5 | 2007 | 1500 L | direct XS producer output |

### Transfer Units

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| (no direct S→XS relay TUs confirmed — outputs feed downstream support boxes) | | | |

### Producers

| Local Id | Name | Bank |
|----------|------|------|
| 2158 | Unc Connector XS1 P1 | XS1 |
| 2179 | Unc Connector XS1 P2 | XS1 |
| 2175 | Unc Connector XS2 P1 | XS2 |
| 2180 | Unc Connector XS2 P2 | XS2 |
| 2171 | Unc Connector XS3 P1 | XS3 |
| 2172 | Unc Connector XS3 P2 | XS3 |
| 2157 | Unc Connector XS4 P1 | XS4 |
| 2174 | Unc Connector XS4 P2 | XS4 |
| 2173 | Unc Connector XS5 P1 | XS5 |
| 2181 | Unc Connector XS5 P2 | XS5 |

---

## Advanced Component

- Product: `component_3` (item type `794666751`, recipe `1319718941`, unit volume `0.5`)
- Producer target: `21600` on medium S buffers, `1000` on XS relay targets

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Adv Comp S1 Source | 6059 | 12000 L | medium producer output |
| Adv Comp XS1 FULL | 3316 | 1500 L | relay from S1 |
| Adv Comp XS2 FULL | 7314 | 1500 L | relay from S1 |

### Transfer Units

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 2985 | TU Adv Comp Sup AlFe | AlFeProduct | Al Fe XS10 → Adv Comp Support XS1 |
| 2986 | TU Adv Comp Sup CuAg | CuAgProduct | Cu-Ag XS1 → Adv Comp Support XS1 |
| 2987 | TU CalcReinfCopper | CalciumReinforcedCopperProduct | CaReinfCop XS B XS1 → Adv Comp Support XS1 |
| 3317 | — | component_3 | Adv Comp S1 Source → Adv Comp XS1 FULL |
| 7313 | — | component_3 | Adv Comp S1 Source → Adv Comp XS2 FULL |

### Producers

| Local Id | Name | Bank |
|----------|------|------|
| 2081 | Adv Comp S1 P1 | S1 |
| 2082 | Adv Comp S1 P2 | S1 |
| 2087 | Adv Comp S1 P3 | S1 |
| 2088 | Adv Comp S1 P4 | S1 |
| 2091 | Adv Comp S1 P5 | S1 |
| 2092 | Adv Comp S1 P6 | S1 |
| 2096 | Adv Comp S1 P7 | S1 |
| 2097 | Adv Comp S1 P8 | S1 |
| 2098 | Adv Comp S1 P9 | S1 |
| 2099 | Adv Comp S1 P10 | S1 |

---

## Advanced Connector

- Product: `connector_3` (item type `2872711781`, recipe `1738589841`, unit volume `0.8`)
- Producer target: `13500`

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Adv Connector S1 | 2287 | 12000 L | medium producer output |

### Transfer Units

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 2811 | TU Adv Conn Sup AlFe | AlFeProduct | Al Fe XS10 → Adv Connector Support XS1 |
| 2812 | TU Adv Conn Sup CaReinfCop | CalciumReinforcedCopperProduct | CaReinfCop XS7 → Adv Connector Support XS1 |
| 2813 | TU Adv Conn Sup CuAg | CuAgProduct | Cu-Ag XS4 → Adv Connector Support XS1 |

### Producers

| Local Id | Name | Bank |
|----------|------|------|
| 2080 | Adv Connector S1 P1 | S1 |
| 2083 | Adv Connector S1 P2 | S1 |
| 2084 | Adv Connector S1 P3 | S1 |
| 2085 | Adv Connector S1 P4 | S1 |
| 2086 | Adv Connector S1 P5 | S1 |
| 2089 | Adv Connector S1 P6 | S1 |
| 2090 | Adv Connector S1 P7 | S1 |
| 2093 | Adv Connector S1 P8 | S1 |
| 2094 | Adv Connector S1 P9 | S1 |
| 2095 | Adv Connector S1 P10 | S1 |

---

## Basic Electronics

- Product: `electronics_1` (item type `1297540454`, recipe `1026118816`, unit volume `4.0`)
- Producer target: `5400`

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Bas Electronics Hub 1 | 2284 | 24000 L | producer output (container_hub) |
| Bas Electronics Supply XS1 | 8754 | 1500 L | support box (component_1 + polycarbonate) |

### Transfer Units

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 8753 | TU BasElectr BasComp XS1 | component_1 | Bas Comp XS3 FULL (1970) → Bas Electronics Supply XS1 (8754) |

### Producers

| Local Id | Name | Bank |
|----------|------|------|
| 2021 | Bas Elect Hub1 P1 | Hub1 |
| 2022 | Bas Elect Hub1 P2 | Hub1 |
| 2023 | Bas Elect Hub1 P3 | Hub1 |
| 2024 | Bas Elect Hub1 P4 | Hub1 |
| 2025 | Bas Elect Hub1 P5 | Hub1 |
| 2026 | Bas Elect Hub1 P6 | Hub1 |
| 2027 | Bas Elect Hub1 P7 | Hub1 |
| 2028 | Bas Elect Hub1 P8 | Hub1 |
| 2029 | Bas Elect Hub1 P9 | Hub1 |
| 2038 | Bas Elect Hub1 P10 | Hub1 |

---

## Uncommon Electronics

- Product: `electronics_2` (item type `1297540453`, recipe `1026118817`, unit volume `4.0`)
- Producer target: `2700`

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Unc Electronics S1 | 2317 | 12000 L | producer output |
| Unc Electronics S2 | 2323 | 12000 L | producer output |
| Unc Electronics 1 Supply XS1 | 4387 | 1500 L | support box for S1 (component_1 + polycalcite) |
| Unc Electronics 2 Supply XS1 | 4087 | 1500 L | support box for S2 (component_1 + polycalcite) |
| Unc Electronics 3 Supply XS1 | 8551 | — | support box for S3 (component_1 + polycarb + polycalcite) |
| Unc Electronics S1 B | 8115 | — | relay output |
| Unc Electronics S2 B | 8117 | — | relay output |

### Transfer Units

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 8751 | TU UncElectr 1 BasComp | component_1 | Bas Comp XS1 (1972) → Unc Electronics 1 Supply XS1 (4387) |
| 4386 | TU UncElectr 1 Polycalcite | PolycalcitePlasticProduct | Polycalcite XS2 (2068) → Unc Electronics 1 Supply XS1 (4387) |
| 8752 | TU UncElectr 2 BasComp | component_1 | Bas Comp XS1 (1972) → Unc Electronics 2 Supply XS1 (4087) |
| 4086 | TU UncElectr 2 Polycalcite | PolycalcitePlasticProduct | Polycalcite XS3 (2069) → Unc Electronics 2 Supply XS1 (4087) |
| 8548 | — | PolycarbonatePlasticProduct | Polycarb S4A (2063) → Unc Electronics 3 Supply XS1 (8551) |
| 8549 | — | PolycalcitePlasticProduct | Polycalcite XS4 (2070) → Unc Electronics 3 Supply XS1 (8551) |
| 8550 | — | component_1 | Bas Comp XS12 (4591) → Unc Electronics 3 Supply XS1 (8551) |
| 8560 | — | — | — → unnamed support box (8558) |
| 8559 | — | component_1 | Bas Comp XS14 (4589) → unnamed support box (8558) |
| 8561 | — | PolycarbonatePlasticProduct | Polycarb S8 (745) → unnamed support box (8558) |
| 8116 | TU UncElectr 2 | electronics_2 | Unc Electronics S1 (2317) + Unc Electronics 3 S1 (8547) → Unc Electronics S1 B (8115) |
| 8118 | TU UncElectr 2 | electronics_2 | Unc Electronics S2 (2323) → Unc Electronics S2 B (8117) |
| 8552 | TU Unc Electronics 3 XS1 | electronics_2 | Unc Electronics 3 S1 (8547) + Unc Electronics 3 XS1 (8553) → Unc Electronics S1 (2317) |

### Producers

#### S1

| Local Id | Name | Bank |
|----------|------|------|
| 2030 | Unc Elect S1 P1 | S1 |
| 2031 | Unc Elect S1 P2 | S1 |
| 2032 | Unc Elect S1 P3 | S1 |
| 2033 | Unc Elect S1 P4 | S1 |
| 2034 | Unc Elect S1 P5 | S1 |
| 2183 | Unc Elect S1 P6 | S1 |
| 2184 | Unc Elect S1 P7 | S1 |
| 2185 | Unc Elect S1 P8 | S1 |
| 2186 | Unc Elect S1 P9 | S1 |
| 2187 | Unc Elect S1 P10 | S1 |

#### S2

| Local Id | Name | Bank |
|----------|------|------|
| 2165 | Unc Elect S2 P1 | S2 |
| 2166 | Unc Elect S2 P2 | S2 |
| 2170 | Unc Elect S2 P3 | S2 |
| 2177 | Unc Elect S2 P4 | S2 |
| 2167 | Unc Elect S2 P5 | S2 |
| 2168 | Unc Elect S2 P6 | S2 |
| 2169 | Unc Elect S2 P7 | S2 |
| 2178 | Unc Elect S2 P8 | S2 |
| 2164 | Unc Elect S2 P9 | S2 |
| 2163 | Unc Elect S2 P10 | S2 |

---

## Advanced Electronics

- Product: `electronics_3` (recipe `1026118818`, unit volume `4.0`)
- Producer target: `2000`

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Adv Electronics S1 | 2294 | 12000 L | producer output |
| Adv Electronics Support XS1 | 2809 | 1500 L | mixed support box (5 items) |

### Transfer Units

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 2804 | Tu Bas Component | component_1 | Bas Comp XS9 FULL (1976) → Adv Electronics Support XS1 (2809) |
| 2805 | Tu Unc Component | component_2 | Unc Comp XS10 (1997) → Adv Electronics Support XS1 (2809) |
| 2806 | — | PolycarbonatePlasticProduct | Polycarb S4A (2063) → Adv Electronics Support XS1 (2809) |
| 2807 | — | PolycalcitePlasticProduct | Polycalcite XS1 (2067) → Adv Electronics Support XS1 (2809) |
| 2808 | — | PolysulfidePlasticProduct | Polysulfide XS1 (1350) → Adv Electronics Support XS1 (2809) |

### Producers

| Local Id | Name | Bank |
|----------|------|------|
| 2105 | Adv Elect S1 P1 | S1 |
| 2106 | Adv Elect S1 P2 | S1 |
| 2107 | Adv Elect S1 P3 | S1 |
| 2108 | Adv Elect S1 P4 | S1 |
| 2109 | Adv Elect S1 P5 | S1 |
| 2110 | Adv Elect S1 P6 | S1 |
| 2111 | Adv Elect S1 P7 | S1 |
| 2112 | Adv Elect S1 P8 | S1 |
| 2113 | Adv Elect S1 P9 | S1 |
| 2114 | Adv Elect S1 P10 | S1 |

---

## Rare Electronics

- Product: `electronics_4` (item type `1297540451`, recipe `1026118819`, unit volume `4.0`)
- Producer target: `2000`

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Rare Electronics S1 | 3011 | — | producer output (Bank A) |
| Rare Electronics S2 | 4556 | — | producer output (Bank B) |
| Rare Elect Support XS1 | 3008 | 1500 L | mixed support box (Bank A, 5 items) |
| Rare Elect Support XS1 | 4557 | 1500 L | mixed support box (Bank B, 5 items) |

### Transfer Units

#### Bank A

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 3009 | — | component_1 | Bas Comp XS8 (1975) → Rare Elect Support XS1 (3008) |
| 3010 | — | component_2 | Unc Comp XS7 (1994) → Rare Elect Support XS1 (3008) |
| 3005 | — | PolycalcitePlasticProduct | Polycalcite XS4 (2070) → Rare Elect Support XS1 (3008) |
| 3006 | — | PolysulfidePlasticProduct | Polysulfide XS2 (1351) → Rare Elect Support XS1 (3008) |
| 3007 | — | FluoropolymerProduct | Fluoropolymer S1 (1912) → Rare Elect Support XS1 (3008) |

#### Bank B

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 4559 | — | component_1 | Bas Comp XS10 (1977) → Rare Elect Support XS1 (4557) |
| 4558 | — | component_2 | Unc Comp B XS2 (2001) → Rare Elect Support XS1 (4557) |
| 4561 | — | PolycalcitePlasticProduct | Polycalcite XS4 (2070) → Rare Elect Support XS1 (4557) |
| 4560 | — | PolysulfidePlasticProduct | Polysulfide XS8 (3603) → Rare Elect Support XS1 (4557) |
| 4562 | — | FluoropolymerProduct | Fluoropolymer XS1 (3598) → Rare Elect Support XS1 (4557) |

### Producers

#### Bank A

| Local Id | Name | Bank |
|----------|------|------|
| 2997 | Rare Elect S1 P1 | S1 |
| 2998 | Rare Elect S1 P2 | S1 |
| 3000 | Rare Elect S1 P3 | S1 |
| 2999 | Rare Elect S1 P4 | S1 |
| 3001 | Rare Elect S1 P5 | S1 |
| 3002 | Rare Elect S1 P6 | S1 |
| 3004 | Rare Elect S1 P7 | S1 |
| 3003 | Rare Elect S1 P8 | S1 |
| 3033 | Rare Elect S1 P9 | S1 |
| 3541 | Rare Elect S1 P10 | S1 |

#### Bank B

| Local Id | Name | Bank |
|----------|------|------|
| 3881 | Rare Elect S2 P1 | S2 |
| 3880 | Rare Elect S2 P2 | S2 |
| 3876 | Rare Elect S2 P3 | S2 |
| 3875 | Rare Elect S2 P4 | S2 |
| 3877 | Rare Elect S2 P5 | S2 |
| 3879 | Rare Elect S2 P6 | S2 |
| 3878 | Rare Elect S2 P7 | S2 |
| 3882 | Rare Elect S2 P8 | S2 |
| 3848 | Rare Elect S2 P9 | S2 |
| 4255 | Rare Elect S2 P10 | S2 |

---

## Basic Power System

- Product: `powersystem_1` (recipe `1458022880`)
- Producer target: `100` (conservative initial)

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Bas Pwr System M1 | 2131 | 96000 L | producer output |

### Transfer Units

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| (direct input — no support TUs; AlFeProduct from Al Fe XS6 (1155), connector_1 from direct boxes 1980, 1979, 1978, 1985, 1986) | | | |

### Producers

| Local Id | Name | Bank |
|----------|------|------|
| 2016 | Bas Pwr M1 P1 | M1 |
| 2017 | Bas Pwr M1 P2 | M1 |
| 2018 | Bas Pwr M1 P3 | M1 |
| 2019 | Bas Pwr M1 P4 | M1 |
| 2020 | Bas Pwr M1 P5 | M1 |
| 2039 | Bas Pwr M1 P6 | M1 |
| 2040 | Bas Pwr M1 P7 | M1 |
| 2041 | Bas Pwr M1 P8 | M1 |
| 2042 | Bas Pwr M1 P9 | M1 |
| 2043 | Bas Pwr M1 P10 | M1 |

---

## Advanced Power System

- Product: `powersystem_3` (recipe `1458022882`)
- Producer target: `100` (conservative initial)

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Adv Power System M1 | 2132 | 96000 L | producer output |
| Adv Pwr Sys Support XS1 | 2463 | 1500 L | mixed support box (5 items) |

### Transfer Units

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 2853 | TU Adv Pwr Sup BasConn | connector_1 | Bas Connect XS10 → Adv Pwr Sys Support XS1 |
| 2854 | TU Al-Fe | AlFeProduct | Al Fe XS10 → Adv Pwr Sys Support XS1 |
| 2855 | TU Adv Pwr Sup CaReinfCop | CalciumReinforcedCopperProduct | CaReinfCop XS8 → Adv Pwr Sys Support XS1 |
| 2856 | TU Adv Pwr Sup UncConn | connector_2 | Unc Connector XS1 → Adv Pwr Sys Support XS1 |
| 2857 | TU Adv Pwr Sup CuAg | CuAgProduct | Cu-Ag XS3 → Adv Pwr Sys Support XS1 |

### Producers

| Local Id | Name | Bank |
|----------|------|------|
| 2075 | Adv Pwr M1 P1 | M1 |
| 2076 | Adv Pwr M1 P2 | M1 |
| 2077 | Adv Pwr M1 P3 | M1 |
| 2078 | Adv Pwr M1 P4 | M1 |
| 2079 | Adv Pwr M1 P5 | M1 |
| 2100 | Adv Pwr M1 P6 | M1 |
| 2101 | Adv Pwr M1 P7 | M1 |
| 2102 | Adv Pwr M1 P8 | M1 |
| 2103 | Adv Pwr M1 P9 | M1 |
| 2104 | Adv Pwr M1 P10 | M1 |

---

## Rare Power System

- Product: `powersystem_4` (item type `527681750`, recipe `1458022909`, unit volume `9.2`)
- Producer target: `9391` on 96000 L outputs

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Rare Pwr Sys M1 | 3216 | 96000 L | producer output (Bank M1) |
| Rare Pwr Sys Support 1 | 3215 | 1500 L | mixed support box (4 items, M1) |
| Rare Pwr Sys M2 | 3272 | — | producer output (Bank M2) |
| Rare Pwr Sys Support 2 | 3278 | 1500 L | mixed support box (5 items, M2) |
| Rare Pwr Sys M3 | 3304 | — | producer output (Bank M3) |
| Rare Pwr Sys Support 3 | 3303 | 1500 L | mixed support box (5 items, M3) |
| Rare Pwr Sys M4 | 6361 | — | producer output (Bank M4) |
| Rare Pwr Sys Support 4 | 6359 | 1500 L | mixed support box (5 items, M4) |

### Transfer Units

#### M1 Support

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 3213 | TU Al-Fe | RedGoldProduct | Red Gold S3 (6946) → Rare Pwr Sys Support 1 (3215) |
| 3214 | TU Cu-Ag | CuAgProduct | Cu-Ag XS2 (2748) → Rare Pwr Sys Support 1 (3215) |
| 3277 | TU CalcReinfCopper | CalciumReinforcedCopperProduct | CaReinfCop XS B XS2 (1211) → Rare Pwr Sys Support 1 (3215) |
| 3309 | TU Unc Connector | connector_2 | Unc Connector XS2 (2004) → Rare Pwr Sys Support 1 (3215) |

> M1 also takes direct `connector_1` input from `Bas Connect XS6 FULL` (1983) and `Bas Connect XS9` (1986).

#### M2 Support

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 3276 | — | RedGoldProduct | Red Gold S3 (6946) → Rare Pwr Sys Support 2 (3278) |
| 3279 | — | CuAgProduct | Cu-Ag XS3 (2749) → Rare Pwr Sys Support 2 (3278) |
| 3280 | — | CalciumReinforcedCopperProduct | CaReinfCop XS B XS6 (1215) → Rare Pwr Sys Support 2 (3278) |
| 3297 | — | connector_1 | Bas Connect XS6 FULL (1983) → Rare Pwr Sys Support 2 (3278) |
| 3298 | — | connector_2 | Unc Connector XS3 (2005) → Rare Pwr Sys Support 2 (3278) |

#### M3 Support

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 3300 | — | RedGoldProduct | Red Gold S2 (3145) → Rare Pwr Sys Support 3 (3303) |
| 3301 | — | CuAgProduct | Cu-Ag XS5 (2751) → Rare Pwr Sys Support 3 (3303) |
| 3302 | — | CalciumReinforcedCopperProduct | CaReinfCop XS B XS8 (1217) → Rare Pwr Sys Support 3 (3303) |
| 3307 | TU Bas Connector | connector_1 | Bas Connect S1 (2011) → Rare Pwr Sys Support 3 (3303) |
| 3305 | — | connector_2 | Unc Connector XS1 (2003) → Rare Pwr Sys Support 3 (3303) |

#### M4 Support

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 6353 | — | RedGoldProduct | Red Gold S2 (3145) → Rare Pwr Sys Support 4 (6359) |
| 6354 | — | CuAgProduct | Cu-Ag XS5 (2751) → Rare Pwr Sys Support 4 (6359) |
| 6356 | — | CalciumReinforcedCopperProduct | CaReinfCop XS B XS9 (1218) → Rare Pwr Sys Support 4 (6359) |
| 6357 | — | connector_1 | Bas Connect XS10 (1987) → Rare Pwr Sys Support 4 (6359) |
| 6355 | — | connector_2 | Unc Connector XS2 (2004) → Rare Pwr Sys Support 4 (6359) |

### Producers

#### M1

| Local Id | Name | Bank |
|----------|------|------|
| 3207 | Rare Power M1 P1 | M1 |
| 3208 | Rare Power M1 P2 | M1 |
| 3209 | Rare Power M1 P3 | M1 |
| 3210 | Rare Power M1 P4 | M1 |
| 3211 | Rare Power M1 P5 | M1 |
| 3212 | Rare Power M1 P6 | M1 |
| 3237 | Rare Power M1 P7 | M1 |
| 3238 | Rare Power M1 P8 | M1 |
| 3239 | Rare Power M1 P9 | M1 |
| 3240 | Rare Power M1 P10 | M1 |

#### M2

| Local Id | Name | Bank |
|----------|------|------|
| 3241 | Rare Power M2 P1 | M2 |
| 3242 | Rare Power M2 P2 | M2 |
| 3243 | Rare Power M2 P3 | M2 |
| 3244 | Rare Power M2 P4 | M2 |
| 3245 | Rare Power M2 P5 | M2 |
| 3273 | Rare Power M2 P6 | M2 |
| 3274 | Rare Power M2 P7 | M2 |
| 3275 | Rare Power M2 P8 | M2 |
| 3288 | Rare Power M2 P9 | M2 |
| 3296 | Rare Power M2 P10 | M2 |

#### M3

| Local Id | Name | Bank |
|----------|------|------|
| 3299 | Rare Power M3 P1 | M3 |
| 3306 | Rare Power M3 P2 | M3 |
| 3321 | Rare Power M3 P3 | M3 |
| 3322 | Rare Power M3 P4 | M3 |
| 3323 | Rare Power M3 P5 | M3 |
| 3324 | Rare Power M3 P6 | M3 |
| 3341 | Rare Power M3 P7 | M3 |
| 4475 | Rare Power M3 P8 | M3 |
| 4476 | Rare Power M3 P9 | M3 |
| 4477 | Rare Power M3 P10 | M3 |

#### M4

| Local Id | Name | Bank |
|----------|------|------|
| 6019 | Rare Power M4 P1 | M4 |
| 6020 | Rare Power M4 P2 | M4 |
| 6021 | Rare Power M4 P3 | M4 |
| 6022 | Rare Power M4 P4 | M4 |
| 6023 | Rare Power M4 P5 | M4 |
| 6036 | Rare Power M4 P6 | M4 |
| 6037 | Rare Power M4 P7 | M4 |
| 6038 | Rare Power M4 P8 | M4 |
| 6039 | Rare Power M4 P9 | M4 |

---

## Rare Quantum Alignment Unit

- Product: `quantumalignmentunit_4` (recipe `1150226655`)
- Producer target: `270`

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| Rare QA Unit S1 | 3579 | — | producer output |
| Rare QA Unit S2 | 3650 | — | producer output |
| Rare QA Unit S3 | 3786 | — | producer output |
| Rare QA Unit S4 | 3824 | — | producer output |
| Rare QA Units Hub | 5676 | — | hub output |
| Rare Elect Support XS1 (S1) | 3580 | 1500 L | 6-item mixed support box |
| Rare Elect Support XS1 (S2) | 3649 | 1500 L | 6-item mixed support box |
| Rare Elect Support XS1 (S3) | 3785 | 1500 L | 6-item mixed support box |
| Rare Elect Support XS1 (S4) | 3823 | 1500 L | 6-item mixed support box |
| RQ Barriers Supply A XS1 | 8259 | 1500 L | 6-item mixed support box (led_1 + led_2 + 4 others) |
| RQ Barriers Supply B XS1 | 8390 | 1500 L | 6-item mixed support box (led_1 + led_2 + 4 others) |
| RQ Barriers Supply C XS1 | 6080 | 1500 L | 6-item mixed support box (led_1 + led_2 + 4 others) |
| RQ Barriers Supply D XS1 | 8280 | 1500 L | 6-item mixed support box (led_1 + led_2 + 4 others) |
| QC Units S1 | 3606 | — | direct second input (quantumcore products) |
| QC Units S2 | 3660 | — | direct second input (quantumcore products) |
| QC Units S3 | 3792 | — | direct second input (quantumcore products) |
| QC Units S4 | 3811 | — | direct second input (quantumcore products) |

### Transfer Units

> 24 support feeder TUs normalized to `maintain 150` per item.
> Support ingredients: `led_1`, `led_2`, `FluoropolymerProduct`, `PolycarbonatePlasticProduct`, `PolycalcitePlasticProduct`, `PolysulfidePlasticProduct`

#### S1 Support Feeders

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 3607 | TU Bas LED | led_1 | → Rare Elect Support XS1 (3580) |
| 3608 | TU Unc LED | led_2 | → Rare Elect Support XS1 (3580) |
| 3614 | TU Fluoropolymer | FluoropolymerProduct | → Rare Elect Support XS1 (3580) |
| 3651 | TU Polycarb | PolycarbonatePlasticProduct | → Rare Elect Support XS1 (3580) |
| 3652 | TU Polycalc | PolycalcitePlasticProduct | → Rare Elect Support XS1 (3580) |
| 3653 | TU Polysulfide | PolysulfidePlasticProduct | → Rare Elect Support XS1 (3580) |

#### S2 Support Feeders

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 3646 | TU Bas LED | led_1 | → Rare Elect Support XS1 (3649) |
| 3647 | TU Unc LED | led_2 | → Rare Elect Support XS1 (3649) |
| 3648 | TU Fluoropolymer | FluoropolymerProduct | → Rare Elect Support XS1 (3649) |
| 3654 | TU Polysulfide | PolysulfidePlasticProduct | → Rare Elect Support XS1 (3649) |
| 3655 | TU Polycalc | PolycalcitePlasticProduct | → Rare Elect Support XS1 (3649) |
| 3656 | TU Polycarb | PolycarbonatePlasticProduct | → Rare Elect Support XS1 (3649) |

#### S3 Support Feeders

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 3779 | TU Bas LED | led_1 | → Rare Elect Support XS1 (3785) |
| 3780 | TU Unc LED | led_2 | → Rare Elect Support XS1 (3785) |
| 3781 | TU Fluoropolymer | FluoropolymerProduct | → Rare Elect Support XS1 (3785) |
| 3782 | TU Polysulfide | PolysulfidePlasticProduct | → Rare Elect Support XS1 (3785) |
| 3783 | TU Polycarb | PolycarbonatePlasticProduct | → Rare Elect Support XS1 (3785) |
| 3784 | TU Polycalcite | PolycalcitePlasticProduct | → Rare Elect Support XS1 (3785) |

#### S4 Support Feeders

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 3825 | TU Bas LED | led_1 | → Rare Elect Support XS1 (3823) |
| 3826 | TU Unc LED | led_2 | → Rare Elect Support XS1 (3823) |
| 3827 | TU Fluoropolymer | FluoropolymerProduct | → Rare Elect Support XS1 (3823) |
| 3828 | TU Polycarb | PolycarbonatePlasticProduct | → Rare Elect Support XS1 (3823) |
| 3829 | TU Polysulfide | PolysulfidePlasticProduct | → Rare Elect Support XS1 (3823) |
| 3830 | TU Polycalcite | PolycalcitePlasticProduct | → Rare Elect Support XS1 (3823) |

#### RQ Barriers LED Feeders

> Oversized LED feeder TUs corrected from `maintain 400` to `maintain 150` on 2026-04-14.
> These feed into RQ Barriers support boxes (8390, 6080) which supply rare-quantum-barrier banks.

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 8380 | *(default)* | led_2 | Unc LED S1 (1500) → RQ Barriers Supply B XS1 (8390) |
| 8381 | *(default)* | led_1 | Bas LED S5 (1505) → RQ Barriers Supply B XS1 (8390) |
| 8421 | *(default)* | led_1 | Bas LED S5 (1505) → RQ Barriers Supply C XS1 (6080) |
| 8422 | *(default)* | led_2 | Unc LED S3 (1497) → RQ Barriers Supply C XS1 (6080) |

### Producers

#### S1

| Local Id | Name | Bank |
|----------|------|------|
| 3538 | Rare QA S1 P1 | S1 |
| 3539 | Rare QA S1 P2 | S1 |
| 3540 | Rare QA S1 P3 | S1 |
| 3576 | Rare QA S1 P4 | S1 |
| 3577 | Rare QA S1 P5 | S1 |
| 3578 | Rare QA S1 P6 | S1 |
| 3590 | Rare QA S1 P7 | S1 |
| 3611 | Rare QA S1 P8 | S1 |
| 3612 | Rare QA S1 P9 | S1 |
| 3613 | Rare QA S1 P10 | S1 |

#### S2

| Local Id | Name | Bank |
|----------|------|------|
| 3642 | Rare QA S2 P1 | S2 |
| 3643 | Rare QA S2 P2 | S2 |
| 3644 | Rare QA S2 P3 | S2 |
| 3645 | Rare QA S2 P4 | S2 |
| 3667 | Rare QA S2 P5 | S2 |
| 3668 | Rare QA S2 P6 | S2 |
| 3669 | Rare QA S2 P7 | S2 |
| 3674 | Rare QA S2 P8 | S2 |
| 3678 | Rare QA S2 P9 | S2 |
| 3679 | Rare QA S2 P10 | S2 |

#### S3

| Local Id | Name | Bank |
|----------|------|------|
| 3689 | Rare QA S3 P1 | S3 |
| 3690 | Rare QA S3 P2 | S3 |
| 3691 | Rare QA S3 P3 | S3 |
| 3692 | Rare QA S3 P4 | S3 |
| 3708 | Rare QA S3 P5 | S3 |
| 3709 | Rare QA S3 P6 | S3 |
| 3710 | Rare QA S3 P7 | S3 |
| 3711 | Rare QA S3 P8 | S3 |
| 3794 | Rare QA S3 P9 | S3 |
| 3795 | Rare QA S3 P10 | S3 |

#### S4

| Local Id | Name | Bank |
|----------|------|------|
| 3796 | Rare QA S4 P1 | S4 |
| 3797 | Rare QA S4 P2 | S4 |
| 3819 | Rare QA S4 P3 | S4 |
| 3820 | Rare QA S4 P4 | S4 |
| 3821 | Rare QA S4 P5 | S4 |
| 3822 | Rare QA S4 P6 | S4 |
| 3834 | Rare QA S4 P7 | S4 |
| 3835 | Rare QA S4 P8 | S4 |
| 3836 | Rare QA S4 P9 | S4 |
| 3843 | Rare QA S4 P10 | S4 |

---

## Quantum Core (QC Units)

- Products: `quantumcore_1` (recipe `1457246784`), `quantumcore_2` (recipe `1457246785`), `quantumcore_3` (recipe `1457246786`), `quantumcore_4` (recipe `1457246787`)
- Producer target: `800`

### Output Buffers

| Name | Local Id | Size | Role |
|------|----------|------|------|
| QC Units S1 | 3606 | — | producer output → feeds Rare QA Unit S1 |
| QC Units S2 | 3660 | — | producer output → feeds Rare QA Unit S2 |
| QC Units S3 | 3792 | — | producer output → feeds Rare QA Unit S3 |
| QC Units S4 | 3811 | — | producer output → feeds Rare QA Unit S4 |
| QC Support XS2 FULL | 3664 | 1500 L | 5-item mixed support (S2) |
| QC Support XS4 | 3838 | 1500 L | 5-item mixed support (S4) |
| QC Support XS5 | 3889 | 1500 L | 5-item mixed support (S3) |
| QC Fluoropoly Support XS1 | 3890 | — | single-item fluoropoly support |
| QC Fluoropoly Support XS2 | 4832 | — | single-item fluoropoly support |

### Transfer Units

#### S2 Support Feeders (→ 3664)

| Local Id | Product | Source → Target |
|----------|---------|-----------------|
| 3661 | PolycarbonatePlasticProduct | → QC Support XS2 FULL (3664) |
| 3662 | PolycalcitePlasticProduct | → QC Support XS2 FULL (3664) |
| 3663 | PolysulfidePlasticProduct | → QC Support XS2 FULL (3664) |
| 3665 | led_1 | → QC Support XS2 FULL (3664) |
| 3666 | led_2 | → QC Support XS2 FULL (3664) |

#### S4 Support Feeders (→ 3838)

| Local Id | Product | Source → Target |
|----------|---------|-----------------|
| 3837 | PolysulfidePlasticProduct | → QC Support XS4 (3838) |
| 3839 | PolycalcitePlasticProduct | → QC Support XS4 (3838) |
| 3840 | PolycarbonatePlasticProduct | → QC Support XS4 (3838) |
| 3841 | led_1 | → QC Support XS4 (3838) |
| 3842 | led_2 | → QC Support XS4 (3838) |

#### S3 Support Feeders (→ 3889)

| Local Id | Product | Source → Target |
|----------|---------|-----------------|
| 3883 | PolycarbonatePlasticProduct | → QC Support XS5 (3889) |
| 3884 | PolycalcitePlasticProduct | → QC Support XS5 (3889) |
| 3885 | PolysulfidePlasticProduct | → QC Support XS5 (3889) |
| 3886 | led_2 | → QC Support XS5 (3889) |
| 3887 | led_1 | → QC Support XS5 (3889) |

#### Fluoropoly Support Feeders

| Local Id | Product | Source → Target |
|----------|---------|-----------------|
| 3888 | FluoropolymerProduct | → QC Fluoropoly Support XS1 (3890) |
| 4831 | FluoropolymerProduct | → QC Fluoropoly Support XS2 (4832) |

### S1 Direct-Input Storages

| Name | Local Id | Content |
|------|----------|---------|
| 3D Bas LED XS1 | 3512 | led_1 |
| 3D Unc LED XS1 | 3518 | led_2 |
| 3D Polycarb XS4 FULL | 3509 | PolycarbonatePlasticProduct |
| 3D Polycalc XS2 | 3432 | PolycalcitePlasticProduct |
| 3D Polysulfide XS1 FULL | 3601 | PolysulfidePlasticProduct |

### Producers

#### S1

| Local Id | Product | Bank |
|----------|---------|------|
| 3060 | quantumcore_1 | S1 |
| 3065 | quantumcore_2 | S1 |
| 3061 | quantumcore_3 | S1 |
| 3064 | quantumcore_3 | S1 |
| 3075 | quantumcore_4 | S1 |
| 3076 | quantumcore_4 | S1 |
| 4830 | quantumcore_4 | S1 |

#### S2

| Local Id | Product | Bank |
|----------|---------|------|
| 3062 | quantumcore_3 | S2 |
| 3063 | quantumcore_3 | S2 |
| 3072 | quantumcore_3 | S2 |
| 3628 | quantumcore_3 | S2 |
| 3077 | quantumcore_4 | S2 |
| 3078 | quantumcore_4 | S2 |
| 4833 | quantumcore_4 | S2 |

#### S3

| Local Id | Product | Bank |
|----------|---------|------|
| 3048 | quantumcore_1 | S3 |
| 3049 | quantumcore_2 | S3 |
| 3068 | quantumcore_3 | S3 |
| 3071 | quantumcore_3 | S3 |
| 3073 | quantumcore_4 | S3 |
| 3074 | quantumcore_4 | S3 |

#### S4

| Local Id | Product | Bank |
|----------|---------|------|
| 3799 | quantumcore_1 | S4 |
| 3800 | quantumcore_2 | S4 |
| 3070 | quantumcore_3 | S4 |
| 3806 | quantumcore_3 | S4 |
| 3807 | quantumcore_4 | S4 |
| 3808 | quantumcore_4 | S4 |