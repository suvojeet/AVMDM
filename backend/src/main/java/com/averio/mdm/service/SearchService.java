package com.averio.mdm.service;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.repository.neo4j.PartyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private final PartyRepository partyRepository;

    public Map<String, Object> globalSearch(String query, int page, int size) {
        List<Party> results = partyRepository.fullTextSearch(query, size * (page + 1));
        int start = page * size;
        List<Party> paged = results.subList(Math.min(start, results.size()), Math.min(start + size, results.size()));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("results", paged);
        response.put("total", results.size());
        response.put("page", page);
        response.put("size", size);
        response.put("query", query);
        return response;
    }

    public List<Party> findSimilar(String globalId) {
        Party party = partyRepository.findByGlobalId(globalId).orElse(null);
        if (party == null) return List.of();
        String searchTerm = party.getLastName() != null ? party.getLastName() : party.getOrganizationName();
        if (searchTerm == null) return List.of();
        return partyRepository.fullTextSearch(searchTerm, 20).stream()
                .filter(p -> !globalId.equals(p.getGlobalId()))
                .toList();
    }
}
