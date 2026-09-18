package com.specmerger.repository;

import com.specmerger.entity.GeneratedDocument;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GeneratedDocumentRepository extends JpaRepository<GeneratedDocument, UUID> {

    /**
     * Row-locks the document for the rest of the transaction — used before computing and
     * inserting the next revision number, so two concurrent edits to the same document (e.g. the
     * same session open in two tabs, sharing the id via localStorage) serialize instead of racing
     * to insert the same {@code revision_number} and violating its unique constraint.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from GeneratedDocument d where d.id = :id")
    Optional<GeneratedDocument> lockById(@Param("id") UUID id);
}
