import { supabase } from '@/lib/supabase';

// Maps sort field from Base44 format ("-field" = desc) to Supabase format
function parseSortField(sortField) {
  if (!sortField) return null;
  const ascending = !sortField.startsWith('-');
  let col = sortField.replace(/^-/, '');
  // Base44 uses created_date, Supabase uses created_at
  if (col === 'created_date') col = 'created_at';
  return { col, ascending };
}

// Normalize row: add created_date alias so existing display code works
function normalizeRow(row) {
  if (!row) return row;
  return { ...row, created_date: row.created_date ?? row.created_at ?? null };
}

export function createEntityApi(tableName) {
  return {
    async list(sortField = null, limit = null) {
      let query = supabase.from(tableName).select('*');
      const sort = parseSortField(sortField);
      if (sort) query = query.order(sort.col, { ascending: sort.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(normalizeRow);
    },

    async create(payload) {
      const { data, error } = await supabase
        .from(tableName)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return normalizeRow(data);
    },

    async update(id, payload) {
      const { id: _id, created_at, created_date, ...data } = payload;
      const { data: result, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return normalizeRow(result);
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },

    // Base44 filter: filter(filters, sortField?, limit?)
    async filter(filters = {}, sortField = null, limit = null) {
      let query = supabase.from(tableName).select('*');
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
      const sort = parseSortField(sortField);
      if (sort) query = query.order(sort.col, { ascending: sort.ascending });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(normalizeRow);
    },
  };
}
