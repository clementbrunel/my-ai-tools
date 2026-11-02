package com.mymoneyhub.entity;

/** Origin of a transaction / balance snapshot row. */
public enum DataSource {
    /** Written by a bank connector sync. */
    SYNC,
    /** Written by the Linxo CSV history import. */
    LINXO
}
