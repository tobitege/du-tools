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
| 5699 | TU bas Connector Rare Magnet XS1 | connector_1 | Bas Connect S1 → Rare Magnet Support XS1 |
| 3932 | TU bas Connector Magnet XS1 | connector_1 | Bas Connect S2 → Magnet Support XS1 FULL |
| 5224 | TU bas Connector unc Magnet XS2 | connector_1 | Bas Connect S2 → Unc Magnet Support XS2 |
| 5233 | TU bas Connector unc Magnet XS3 | connector_1 | Bas Connect S2 → Unc Magnet Support XS3 |
| 7707 | TU bas Connector Rare Magnet XS3 | connector_1 | Bas Connect S2 → Rare Magnet Support XS3 |

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
| 3317 | TU adv Component Adv Comp XS1 | component_3 | Adv Comp S1 Source → Adv Comp XS1 FULL |
| 7313 | TU adv Component Adv Comp XS2 | component_3 | Adv Comp S1 Source → Adv Comp XS2 FULL |

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
| 8548 | TU Polycarb unc Electronics 3 | PolycarbonatePlasticProduct | Polycarb S4A (2063) → Unc Electronics 3 Supply XS1 (8551) |
| 8549 | TU Polycalcite unc Electronics 3 | PolycalcitePlasticProduct | Polycalcite XS4 (2070) → Unc Electronics 3 Supply XS1 (8551) |
| 8550 | TU bas Component unc Electronics 3 | component_1 | Bas Comp XS12 (4591) → Unc Electronics 3 Supply XS1 (8551) |
| 8560 | TU Polycalcite unc Electronics D | PolycalcitePlasticProduct | Polycalcite XS4 (2070) → unc Electronics D Support XS1 (8558) |
| 8559 | TU bas Component unc Electronics D | component_1 | Bas Comp XS14 (4589) → unc Electronics D Support XS1 (8558) |
| 8561 | TU Polycarb unc Electronics D | PolycarbonatePlasticProduct | Polycarb S8 (745) → unc Electronics D Support XS1 (8558) |
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
| 2806 | TU Polycarb adv Electronics | PolycarbonatePlasticProduct | Polycarb S4A (2063) → Adv Electronics Support XS1 (2809) |
| 2807 | TU Polycalcite adv Electronics | PolycalcitePlasticProduct | Polycalcite XS1 (2067) → Adv Electronics Support XS1 (2809) |
| 2808 | TU Polysulfide adv Electronics | PolysulfidePlasticProduct | Polysulfide XS1 (1350) → Adv Electronics Support XS1 (2809) |

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
| 3009 | TU bas Component Rare Elect 3008 | component_1 | Bas Comp XS8 (1975) → Rare Elect Support XS1 (3008) |
| 3010 | TU unc Component Rare Elect 3008 | component_2 | Unc Comp XS7 (1994) → Rare Elect Support XS1 (3008) |
| 3005 | TU Polycalcite Rare Elect 3008 | PolycalcitePlasticProduct | Polycalcite XS4 (2070) → Rare Elect Support XS1 (3008) |
| 3006 | TU Polysulfide Rare Elect 3008 | PolysulfidePlasticProduct | Polysulfide XS2 (1351) → Rare Elect Support XS1 (3008) |
| 3007 | TU Fluoropoly Rare Elect 3008 | FluoropolymerProduct | Fluoropolymer S1 (1912) → Rare Elect Support XS1 (3008) |

#### Bank B

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 4559 | TU bas Component Rare Elect 4557 | component_1 | Bas Comp XS10 (1977) → Rare Elect Support XS1 (4557) |
| 4558 | TU unc Component Rare Elect 4557 | component_2 | Unc Comp B XS2 (2001) → Rare Elect Support XS1 (4557) |
| 4561 | TU Polycalcite Rare Elect 4557 | PolycalcitePlasticProduct | Polycalcite XS4 (2070) → Rare Elect Support XS1 (4557) |
| 4560 | TU Polysulfide Rare Elect 4557 | PolysulfidePlasticProduct | Polysulfide XS8 (3603) → Rare Elect Support XS1 (4557) |
| 4562 | TU Fluoropoly Rare Elect 4557 | FluoropolymerProduct | Fluoropolymer XS1 (3598) → Rare Elect Support XS1 (4557) |

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
| 3276 | TU Red Gold Rare Pwr Sys 2 | RedGoldProduct | Red Gold S3 (6946) → Rare Pwr Sys Support 2 (3278) |
| 3279 | TU CuAg Rare Pwr Sys 2 | CuAgProduct | Cu-Ag XS3 (2749) → Rare Pwr Sys Support 2 (3278) |
| 3280 | TU CaReinfCop Rare Pwr Sys 2 | CalciumReinforcedCopperProduct | CaReinfCop XS B XS6 (1215) → Rare Pwr Sys Support 2 (3278) |
| 3297 | TU bas Connector Rare Pwr Sys 2 | connector_1 | Bas Connect XS6 FULL (1983) → Rare Pwr Sys Support 2 (3278) |
| 3298 | TU unc Connector Rare Pwr Sys 2 | connector_2 | Unc Connector XS3 (2005) → Rare Pwr Sys Support 2 (3278) |

#### M3 Support

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 3300 | TU Red Gold Rare Pwr Sys 3 | RedGoldProduct | Red Gold S2 (3145) → Rare Pwr Sys Support 3 (3303) |
| 3301 | TU CuAg Rare Pwr Sys 3 | CuAgProduct | Cu-Ag XS5 (2751) → Rare Pwr Sys Support 3 (3303) |
| 3302 | TU CaReinfCop Rare Pwr Sys 3 | CalciumReinforcedCopperProduct | CaReinfCop XS B XS8 (1217) → Rare Pwr Sys Support 3 (3303) |
| 3307 | TU Bas Connector | connector_1 | Bas Connect S1 (2011) → Rare Pwr Sys Support 3 (3303) |
| 3305 | TU unc Connector Rare Pwr Sys 3 | connector_2 | Unc Connector XS1 (2003) → Rare Pwr Sys Support 3 (3303) |

#### M4 Support

| Local Id | Name | Product | Source → Target |
|----------|------|---------|-----------------|
| 6353 | TU Red Gold Rare Pwr Sys 4 | RedGoldProduct | Red Gold S2 (3145) → Rare Pwr Sys Support 4 (6359) |
| 6354 | TU CuAg Rare Pwr Sys 4 | CuAgProduct | Cu-Ag XS5 (2751) → Rare Pwr Sys Support 4 (6359) |
| 6356 | TU CaReinfCop Rare Pwr Sys 4 | CalciumReinforcedCopperProduct | CaReinfCop XS B XS9 (1218) → Rare Pwr Sys Support 4 (6359) |
| 6357 | TU bas Connector Rare Pwr Sys 4 | connector_1 | Bas Connect XS10 (1987) → Rare Pwr Sys Support 4 (6359) |
| 6355 | TU unc Connector Rare Pwr Sys 4 | connector_2 | Unc Connector XS2 (2004) → Rare Pwr Sys Support 4 (6359) |

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

## Quantum Barrier Setup Pass (2026-04-21)

- Construct: `1002090` `POIN Factory 26-04-21`
- Player: `10000`

### Live Topology Proof

- `Adv Q Barriers S1` (`8273`) is a producer-output medium box for ten electronics producers `8244-8253`.
- `8273` also feeds downstream assembly consumers `5557` `Adv Shield Gen L Assy 1` and `8698` `Adv Shield Gen XS Assy 1`.
- `8273` direct-input quantum-core box is `9060` `QCores XS6`.
- `8273` mixed support box is `8280` `RQ Barriers Supply D XS1`.
- `Rare Q Barriers S3` (`6063`) is a producer-output medium box for ten electronics producers `8400-8409`.
- `6063` direct-input quantum-core box is `3792` `QC Units S3`.
- `6063` mixed support box is `6080` `RQ Barriers Supply C XS1`.
- `6063` is also a relay source into `8427` `TU R Quant Barrier 1`, `8425` `TU R Quant Barrier 2`, `8426` `TU R Quant Barrier 3`, and `8428` `TU R Quant Barrier 4`.
- Topology contradiction resolved:
  - tracked line `8280` as a 6-item Quantum Barrier support box was wrong for the advanced branch
  - live support topology on `8280` proved only four feeder TUs: `8274` `AlLiProduct`, `8275` `DuraluminProduct`, `8276` `SiluminProduct`, `8277` `led_1`
  - no `led_2` or `ScAlProduct` feeder exists on `8280`

### Resolved Recipes And Sizing

- `Advanced Quantum Barrier`
  - recipe `381576797`
  - item type `984088007`
  - unit volume `25 L`
  - output box `8273` capacity `12000 L`
  - producer target chosen: `maintain 43` per machine (`430` units total, `10750 L`, about `89.6%`)
- `Rare Quantum Barrier`
  - recipe `381576796`
  - item type `984088006`
  - unit volume `27.5 L`
  - output box `6063` capacity `12000 L`
  - producer target chosen: `maintain 39` per machine (`390` units total, `10725 L`, about `89.4%`)
- `8280` support sizing
  - XS box capacity `1500 L`
  - 4-item mixed support
  - feeder target chosen: `maintain 250` per item (`1000 L` total target)
- `6080` support sizing
  - XS box capacity `1500 L`
  - 6-item mixed support
  - existing LED feeders `8421` and `8422` were already live at `maintain 150`
  - metal feeders matched to the same live-proven target: `maintain 150` per item (`900 L` total target across six items)

### Configured

- Advanced branch support correction:
  - soft-stopped `8277`
  - rewrote `8274` -> `AlLiProduct maintain 250`
  - rewrote `8275` -> `DuraluminProduct maintain 250`
  - rewrote `8276` -> `SiluminProduct maintain 250`
  - rewrote `8277` -> `led_1 maintain 250`
- Advanced producer bank setup:
  - configured `8244-8253` to recipe `381576797` `Advanced Quantum Barrier`
  - final mode `maintain 43`
- Rare branch support setup:
  - configured `8417` -> `AlLiProduct maintain 150`
  - configured `8418` -> `DuraluminProduct maintain 150`
  - configured `8419` -> `SiluminProduct maintain 150`
  - configured `8420` -> `ScAlProduct maintain 150`
  - left existing `8421` `led_1 maintain 150` and `8422` `led_2 maintain 150` unchanged
- Rare producer bank setup:
  - configured `8400-8409` to recipe `381576796` `Rare Quantum Barrier`
  - final mode `maintain 39`
- Rare relay setup:
  - proved `8425-8428` target `8424` `Rare Q Barriers Hub`
  - `8424` hub children are `6062` `Rare Q Barriers Main S1` and `6061` `Rare Q Barriers Main S2`
  - configured `8425-8428` to `quantumbarrier_4` item type `984088006`
  - final mode `maintain 100`
  - conservative relay target chosen because downstream shield assemblies are still unconfigured and the hub has no live drain yet

### Remaining Blockers

- `Adv Q Barriers S1`
  - blocker type: `production cycle time / transit delay`
  - setup is complete and the live producer bank is consuming inputs
- `Rare Q Barriers S3`
  - blocker type: `production cycle time / transit delay`
  - setup is complete and the live producer bank is consuming inputs
  - relay TUs `8425-8428` are now configured and waiting on source product from `8270`, `8378`, and `6063`
  - next proven blocker after the relay layer is downstream assembly setup:
    - `8325` `Rare Cap Shield Gen L Assy 1` -> `STOPPED recipeId 0`
    - `8391` `Rare Act Shield Gen L Assy 1` -> `STOPPED recipeId 0`
    - `6088` `Rare Vari Shield L Assy 2` -> `STOPPED recipeId 0`
    - `6089` `Rare Vari Shield Gen L Assy 1` -> `STOPPED recipeId 0`
  - downstream shield-assembly bank is a separate setup pass

### Rare Quantum Barrier Sibling Support Correction (2026-04-21)

- Follow-up correction:
  - previous pass completed `RQ Barriers Supply C XS1` but did not finish the full rare-quantum-barrier sibling support set
  - rare-quantum-barrier electronics branches use three separate mixed support boxes:
    - `8259` `RQ Barriers Supply A XS1` -> `8270` `Rare Q Barriers S1`
    - `8390` `RQ Barriers Supply B XS1` -> `8378` `Rare Q Barriers S2`
    - `6080` `RQ Barriers Supply C XS1` -> `6063` `Rare Q Barriers S3`

- Additional topology proof:
  - `8259` consumers are electronics `6993-6996, 8238-8243`
  - direct-input quantum-core box for `8270` is `3812` `QC Units S5`
  - `8390` consumers are electronics `8368-8377`
  - direct-input quantum-core box for `8378` is `3811` `QC Units S4`

- Additional feeder TUs proven live on `8259`:
  - `8261` `led_2` from `1497` `Unc LED S3`
  - `8262` `led_1` from `794` `Bas LED S6`
  - `8266` `ScAlProduct` from `3332` `Sc-Al XS2`
  - `8267` `AlLiProduct` from `2793` `Al-Li XS A1`
  - `8268` `DuraluminProduct` from `1191` `Duralumin XS2`
  - `8269` `SiluminProduct` from `1166` `Silumin XS7`

- Additional feeder TUs proven live on `8390`:
  - `8380` `led_2` from `1500` `Unc LED S1`
  - `8381` `led_1` from `1505` `Bas LED S5`
  - `8382` `SiluminProduct` from `1160` `Silumin XS1`
  - `8383` `DuraluminProduct` from `1190` `Duralumin XS1`
  - `8384` `AlLiProduct` from `5078` `Al Li Alloy S2`
  - `8385` `ScAlProduct` from `3332` `Sc-Al XS2`

- Additional configured:
  - soft-stopped oversized `8259` LED feeders `8261` and `8262`
  - rewrote `8261-8262` to `maintain 150`
  - configured stopped `8266-8269` to `maintain 150`
  - configured stopped `8382-8385` to `maintain 150`
  - normalized `8270` producer bank `6993-6996, 8238-8243` from old `maintain 200` to `maintain 39`
  - configured previously blank `8378` producer bank `8368-8377` to recipe `381576796` `maintain 39`

- Updated blocker classification:
  - `Rare Q Barriers S1`: `production cycle time / transit delay`
  - `Rare Q Barriers S2`: `production cycle time / transit delay`
  - `Rare Q Barriers S3`: `production cycle time / transit delay`
  - next downstream blocker remains shield-assembly setup at `8325`, `8391`, `6088`, `6089`

### Electronics Naming Pass (2026-04-21)

- Construct id used on all rename calls: `1002090`
- Confirmed default or off-scheme electronics industry/TUs renamed from live recipe or live TU item state only:
  - `8244-8253` -> `Adv Q Barrier S1 1-10`
  - `8274-8277` -> `TU Adv Q Supply D AlLi`, `Dural`, `Silum`, `LED1`
  - `6993-6996`, `8238-8243` -> `Rare Q Barrier S1 1-10`
  - `8261-8262`, `8266-8269` -> `TU RQ Supply A ...`
  - `8368-8377` -> `Rare Q Barrier S2 1-10`
  - `8380-8385` -> `TU RQ Supply B ...`
  - `8400-8409` -> `Rare Q Barrier S3 1-10`
  - `8417-8422` -> `TU RQ Supply C ...`
  - `8425-8428` -> `TU RQ Barriers Hub 1-4`
- Naming rule applied:
  - tier abbreviations kept as `adv`
  - rare branch names kept as `Rare Q ...`

### Electronics Container Naming Pass (2026-04-21)

- Additional linked support or buffer containers renamed:
  - `9060` `QCores XS6` -> `Adv Q Barrier QC XS1`
  - `3812` `QC Units S5` -> `RQ Barriers QC S1`
  - `3811` `QC Units S4` -> `RQ Barriers QC S2`
  - `3792` `QC Units S3` -> `RQ Barriers QC S3`
- Not renamed:
  - nearby default containers such as `8739`, `8738`, `6074`, `6064`
  - they are not linked on live inspect, so they were not treated as proven support, buffer, or supply containers

### Magnet Setup Pass (2026-04-21)

- Construct id used on all reads and writes: `1002090`

- Proven magnet output buffers and direct-input support boxes:
  - `3929` `Bas Magnet Main S1 FULL` <- producers `2615, 2635, 4784, 7192, 8613`; direct-input support `3935` `Magnet Support XS1 FULL`; relay TU `8890` -> `8889` `Bas Magnet Main S2`
  - `3931` `Unc Magnet S1` <- producers `2434, 2633, 2621, 2610, 2611, 4788, 4789, 4790, 5207, 5208`; direct-input supports `3935` and `2946`
  - `2900` `Unc Magnet S2` <- producers `5212-5221`; direct-input support `5225`
  - `5230` `Unc Magnet S3` <- producers `5269-5278`; direct-input support `5234`
  - `2901` `Unc Magnet S4` <- producers `5248-5257`; direct-input support `2945`
  - `2892` `Unc Magnet S5` <- producers `5279-5288`; direct-input support `2934`
  - `3930` `Adv Magnet S1` <- producers `5115-5124`; direct-input supports `3935` and `5126`
  - `5156` `Adv Magnet S2` <- producers `3570, 4880, 5139-5144, 5157, 5158`; direct-input support `5155`
  - `2876` `Rare Magnet S1` <- producers `3625, 3542, 3626, 4879, 3729, 3728, 3725, 3543, 5701, 5702`; direct-input support `2911`
  - `7696` `Rare Magnet S2` <- producers `7208, 7203, 7204, 7207, 7676, 7673, 7677, 7674, 7678, 7675`; direct-input support `7702`
  - `7704` `Rare Magnet S3` <- producers `7679, 7682, 7683, 7684, 7685, 7686, 7687, 7688, 7692, 7693`; direct-input support `7710`

- Topology proof kept for later passes:
  - `3935` is a shared basic-input box for basic, uncommon S1, and advanced S1 magnets
  - `3931` uncommon S1 is a mixed producer bank with both `IndustryMetalwork` and `IndustryMetalwork2`, so writes had to split by element type

- Configured support TUs:
  - `3932-3934` -> `connector_1 2872711779`, `SteelProduct 511774178`, `StainlessSteelProduct 2984358477` at `maintain 400`
  - `5209-5211` -> `StainlessSteelProduct 2984358477`, `SteelProduct 511774178`, `connector_1 2872711779` at `maintain 400`
  - `5222-5224` -> `StainlessSteelProduct 2984358477`, `SteelProduct 511774178`, `connector_1 2872711779` at `maintain 400`
  - `5231-5233` -> `StainlessSteelProduct 2984358477`, `SteelProduct 511774178`, `connector_1 2872711779` at `maintain 400`
  - `5243-5245` -> `StainlessSteelProduct 2984358477`, `SteelProduct 511774178`, `connector_1 2872711779` at `maintain 400`
  - `5289-5290, 5327` -> `StainlessSteelProduct 2984358477`, `SteelProduct 511774178`, `connector_1 2872711779` at `maintain 400`
  - `5125, 5127-5130` -> `InconelProduct 167908167`, `SteelProduct 511774178`, `StainlessSteelProduct 2984358477`, `connector_2 2872711778`, `connector_1 2872711779` at `maintain 250`
  - `5149-5151, 5153-5154` -> `SteelProduct 511774178`, `StainlessSteelProduct 2984358477`, `InconelProduct 167908167`, `connector_2 2872711778`, `connector_1 2872711779` at `maintain 250`
  - `5696-5700` -> `StainlessSteelProduct 2984358477`, `InconelProduct 167908167`, `MaragingSteelProduct 3518490274`, `connector_1 2872711779`, `connector_2 2872711778` at `maintain 250`
  - `7697-7701` -> `InconelProduct 167908167`, `StainlessSteelProduct 2984358477`, `connector_1 2872711779`, `connector_2 2872711778`, `MaragingSteelProduct 3518490274` at `maintain 250`
  - `7705-7709` -> `InconelProduct 167908167`, `StainlessSteelProduct 2984358477`, `connector_1 2872711779`, `connector_2 2872711778`, `MaragingSteelProduct 3518490274` at `maintain 250`

- Configured producers:
  - basic magnets `2615, 2635, 4784, 7192, 8613` -> recipe `1949200608` `magnet_1` item `1246524878`, `maintain 1000`
  - uncommon magnets `2434, 2633, 2621, 2610, 2611, 4788, 4789, 4790, 5207, 5208, 5212-5221, 5269-5278, 5248-5257, 5279-5288` -> recipe `1949200609` `magnet_2` item `1246524879`, `maintain 1000`
  - advanced magnets `5115-5124, 3570, 4880, 5139-5144, 5157, 5158` -> recipe `1949200610` `magnet_3` item `1246524876`, `maintain 1000`
  - rare magnets `3625, 3542, 3626, 4879, 3729, 3728, 3725, 3543, 5701, 5702, 7208, 7203, 7204, 7207, 7676, 7673, 7677, 7674, 7678, 7675, 7679, 7682, 7683, 7684, 7685, 7686, 7687, 7688, 7692, 7693` -> recipe `1949200611` `magnet_4` item `1246524877`, `maintain 1000`

- Configured relay:
  - `8890` -> `magnet_1` item `1246524878`, `maintain 600` into `8889` `Bas Magnet Main S2`

- Follow-up correction on rare supports:
  - `2911` and `7710` still held old `connector_1 x1000`, which blocked `connector_2` refill as `JAMMED_OUTPUT_FULL`
  - moved `750` `connector_1` from `2911` back to `2011` `Bas Connect S1`
  - moved `750` `connector_1` from `7710` back to `2010` `Bas Connect S2`
  - after the move, `5700` and `7708` resumed `RUNNING`, `connector_2` landed in both boxes, and sample rare producers `3625` and `7679` resumed `RUNNING`

- Current blocker classification after live recheck:
  - `3929` `Bas Magnet Main S1 FULL`: `production cycle time`
  - `8889` `Bas Magnet Main S2`: `source starvation / transit delay`
  - `3931` `Unc Magnet S1`: `production cycle time`
  - `2900` `Unc Magnet S2`: `production cycle time`
  - `5230` `Unc Magnet S3`: `production cycle time`
  - `2901` `Unc Magnet S4`: `production cycle time`
  - `2892` `Unc Magnet S5`: `production cycle time`
  - `3930` `Adv Magnet S1`: `production cycle time`
  - `5156` `Adv Magnet S2`: `production cycle time`
  - `2876` `Rare Magnet S1`: `production cycle time`
  - `7696` `Rare Magnet S2`: `production cycle time`
  - `7704` `Rare Magnet S3`: `production cycle time`
