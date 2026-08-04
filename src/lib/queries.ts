import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Family, Product } from "./mdvd";

export const productsQuery = () =>
  queryOptions({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const all: Product[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("family", { ascending: true })
          .order("name", { ascending: true })
          .range(from, from + page - 1);
        if (error) throw error;
        all.push(...((data ?? []) as unknown as Product[]));
        if (!data || data.length < page) break;
      }
      return all;
    },
  });

export const familiesQuery = () =>
  queryOptions({
    queryKey: ["families"],
    queryFn: async (): Promise<Family[]> => {
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .order("items_count", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Family[];
    },
  });
