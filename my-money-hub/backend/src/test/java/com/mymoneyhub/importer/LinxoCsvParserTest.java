package com.mymoneyhub.importer;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Fixtures are invented: same layout as a Linxo export, no real data. */
class LinxoCsvParserTest {

    private static final String HEADER =
            "Date;Libellé;Catégorie;Montant;Notes;N° de chèque;Labels;Nom du compte;Nom de la connexion\n";
    private static final String BODY =
            "05/10/2026;ORG EXEMPLE;Aides et allocations;76,13;VIR SEPA RECU /DE ORG EXEMPLE;;;Compte Joint;Banque Test\n"
                    + "05/10/2026;MAGASIN TEST;Vêtements;-122,73;\"FACTURE CARTE; \"\"MAGASIN\"\"\";;;Compte Joint;Banque Test\n"
                    + "02/01/2014;VIR PERSO;Fonctionnement;-1 234,50;;;;Livret Test;Autre Banque\n";

    private final LinxoCsvParser parser = new LinxoCsvParser();

    @Test
    void parsesRowsOfSeveralAccounts() {
        var result = parser.parse((HEADER + BODY).getBytes(StandardCharsets.UTF_8));

        assertThat(result.rejected()).isZero();
        assertThat(result.rows()).hasSize(3);
        LinxoRow first = result.rows().get(0);
        assertThat(first.date()).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(first.amount()).isEqualByComparingTo("76.13");
        assertThat(first.category()).isEqualTo("Aides et allocations");
        assertThat(first.account()).isEqualTo("Compte Joint");
        assertThat(first.connection()).isEqualTo("Banque Test");
        assertThat(result.rows().get(1).notes()).isEqualTo("FACTURE CARTE; \"MAGASIN\"");
        assertThat(result.rows().get(2).amount()).isEqualByComparingTo("-1234.50");
        assertThat(result.rows().get(2).account()).isEqualTo("Livret Test");
    }

    @Test
    void readsWindows1252AndBomAndColumnOrder() {
        String csv = "Montant;Date;Nom du compte;Nom de la connexion;Libellé\n-5,00;01/02/2020;Compte é;Banque;CAFÉ\n";
        var cp1252 = parser.parse(csv.getBytes(Charset.forName("windows-1252")));
        assertThat(cp1252.rows()).singleElement().satisfies(r -> {
            assertThat(r.label()).isEqualTo("CAFÉ");
            assertThat(r.account()).isEqualTo("Compte é");
            assertThat(r.amount()).isEqualByComparingTo("-5");
        });

        byte[] utf8 = csv.getBytes(StandardCharsets.UTF_8);
        byte[] withBom = new byte[utf8.length + 3];
        withBom[0] = (byte) 0xEF;
        withBom[1] = (byte) 0xBB;
        withBom[2] = (byte) 0xBF;
        System.arraycopy(utf8, 0, withBom, 3, utf8.length);
        assertThat(parser.parse(withBom).rows()).hasSize(1);
    }

    @Test
    void rejectsBadRowsWithoutFailingTheFile() {
        String csv = HEADER + "pas une date;X;;1,00;;;;C;B\n01/01/2020;X;;abc;;;;C;B\n01/01/2020;X;;2,50;;;;C;B\n";
        var result = parser.parse(csv.getBytes(StandardCharsets.UTF_8));

        assertThat(result.rows()).singleElement().extracting(LinxoRow::amount).isEqualTo(new BigDecimal("2.50"));
        assertThat(result.rejected()).isEqualTo(2);
        assertThat(result.errors()).hasSize(2);
    }

    @Test
    void failsOnNonLinxoFile() {
        assertThatThrownBy(() -> parser.parse("a;b;c\n1;2;3\n".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Colonne manquante");
    }
}
