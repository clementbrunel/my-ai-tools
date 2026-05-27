package com.pronocore.service;

import com.pronocore.dto.request.CreateDailyGageRequest;
import com.pronocore.dto.response.DailyGageCandidateResponse;
import com.pronocore.dto.response.DailyGageResponse;
import com.pronocore.dto.response.ForfeitResponse;
import com.pronocore.entity.*;
import com.pronocore.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DailyGageService {

    private final DailyGageRepository          dailyGageRepository;
    private final DailyGageCandidateRepository candidateRepository;
    private final DailyGageVoteRepository      voteRepository;
    private final ForfeitRepository            forfeitRepository;
    private final UserRepository               userRepository;
    private final UserForfeitRepository        userForfeitRepository;
    private final BetParticipationRepository   betParticipationRepository;
    private final MatchRepository              matchRepository;

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<DailyGageResponse> getAllDailyGages() {
        String username = currentUsername();
        return dailyGageRepository.findAllByOrderByMatchDateDesc().stream()
                .map(dg -> toResponse(dg, username))
                .toList();
    }

    @Transactional(readOnly = true)
    public DailyGageResponse getDailyGageByDate(LocalDate date) {
        String username = currentUsername();
        DailyGage dg = dailyGageRepository.findByMatchDate(date)
                .orElseThrow(() -> new EntityNotFoundException("No daily gage for date: " + date));
        return toResponse(dg, username);
    }

    @Transactional(readOnly = true)
    public DailyGageResponse getDailyGageById(Long id) {
        String username = currentUsername();
        DailyGage dg = dailyGageRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("DailyGage not found: " + id));
        return toResponse(dg, username);
    }

    // ---------------------------------------------------------------
    // Admin commands
    // ---------------------------------------------------------------

    @Transactional
    public DailyGageResponse createDailyGage(CreateDailyGageRequest req) {
        if (dailyGageRepository.findByMatchDate(req.getMatchDate()).isPresent()) {
            throw new IllegalStateException("A daily gage already exists for " + req.getMatchDate());
        }
        DailyGage dg = DailyGage.builder()
                .matchDate(req.getMatchDate())
                .mode(req.getMode())
                .status(DailyGage.Status.PENDING)
                .build();
        dg = dailyGageRepository.save(dg);
        log.info("📅 Daily gage created for {} [{}]", req.getMatchDate(), req.getMode());
        return toResponse(dg, currentUsername());
    }

    /** DIRECT mode: admin picks the forfeit → status becomes ACTIVE. */
    @Transactional
    public DailyGageResponse selectForfeitDirectly(Long dailyGageId, Long forfeitId) {
        DailyGage dg = requireDailyGage(dailyGageId);
        if (dg.getStatus() == DailyGage.Status.SETTLED) {
            throw new IllegalStateException("Daily gage is already settled");
        }
        Forfeit forfeit = requireForfeit(forfeitId);
        dg.setForfeit(forfeit);
        dg.setStatus(DailyGage.Status.ACTIVE);
        dailyGageRepository.save(dg);
        log.info("✅ Forfeit '{}' selected directly for {}", forfeit.getTitle(), dg.getMatchDate());
        return toResponse(dg, currentUsername());
    }

    /** VOTE mode: add a candidate forfeit to the pool. */
    @Transactional
    public DailyGageResponse addCandidate(Long dailyGageId, Long forfeitId) {
        DailyGage dg = requireDailyGage(dailyGageId);
        if (dg.getStatus() == DailyGage.Status.SETTLED) {
            throw new IllegalStateException("Daily gage is already settled");
        }
        if (candidateRepository.findByDailyGageIdAndForfeitId(dailyGageId, forfeitId).isPresent()) {
            throw new IllegalStateException("Forfeit already a candidate for this day");
        }
        Forfeit forfeit = requireForfeit(forfeitId);
        DailyGageCandidate c = DailyGageCandidate.builder()
                .dailyGage(dg)
                .forfeit(forfeit)
                .build();
        candidateRepository.save(c);
        // Auto-activate if first candidate added in VOTE mode
        if (dg.getStatus() == DailyGage.Status.PENDING) {
            dg.setStatus(DailyGage.Status.ACTIVE);
            dailyGageRepository.save(dg);
        }
        return toResponse(dailyGageRepository.findById(dailyGageId).orElseThrow(), currentUsername());
    }

    /** VOTE mode: remove a candidate. */
    @Transactional
    public DailyGageResponse removeCandidate(Long dailyGageId, Long forfeitId) {
        DailyGage dg = requireDailyGage(dailyGageId);
        DailyGageCandidate c = candidateRepository
                .findByDailyGageIdAndForfeitId(dailyGageId, forfeitId)
                .orElseThrow(() -> new EntityNotFoundException("Candidate not found"));
        candidateRepository.delete(c);
        return toResponse(dailyGageRepository.findById(dailyGageId).orElseThrow(), currentUsername());
    }

    // ---------------------------------------------------------------
    // Player vote
    // ---------------------------------------------------------------

    /**
     * Cast or change a vote (+1 / -1) on a candidate.
     * Pass vote=0 to remove the vote.
     */
    @Transactional
    public DailyGageResponse vote(Long dailyGageId, Long forfeitId, int voteValue) {
        DailyGage dg = requireDailyGage(dailyGageId);
        if (dg.getStatus() == DailyGage.Status.SETTLED) {
            throw new IllegalStateException("Voting is closed — gage already settled");
        }
        if (dg.getMode() != DailyGage.Mode.VOTE) {
            throw new IllegalStateException("This daily gage is not in VOTE mode");
        }
        DailyGageCandidate candidate = candidateRepository
                .findByDailyGageIdAndForfeitId(dailyGageId, forfeitId)
                .orElseThrow(() -> new EntityNotFoundException("Candidate not found"));

        String username = currentUsername();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + username));

        Optional<DailyGageVote> existing = voteRepository.findByCandidateIdAndUserId(candidate.getId(), user.getId());

        if (voteValue == 0) {
            existing.ifPresent(voteRepository::delete);
        } else {
            if (existing.isPresent()) {
                existing.get().setVote(voteValue);
                voteRepository.save(existing.get());
            } else {
                DailyGageVote v = DailyGageVote.builder()
                        .candidate(candidate)
                        .user(user)
                        .vote(voteValue)
                        .build();
                voteRepository.save(v);
            }
        }
        return toResponse(dailyGageRepository.findById(dailyGageId).orElseThrow(), username);
    }

    // ---------------------------------------------------------------
    // Auto-settlement (called by MatchService)
    // ---------------------------------------------------------------

    /**
     * Called after every match settlement.
     * If all matches of that calendar day are now FINISHED and a daily gage
     * is configured, assigns the gage to the player with the fewest daily points.
     */
    @Transactional
    public void onMatchSettled(LocalDate matchDay) {
        LocalDateTime startOfDay = matchDay.atStartOfDay();
        LocalDateTime endOfDay   = matchDay.plusDays(1).atStartOfDay();

        long unfinished = matchRepository.countUnfinishedMatchesOnDay(startOfDay, endOfDay);
        if (unfinished > 0) {
            log.debug("⏳ {} match(es) still unfinished on {} — gage deferred", unfinished, matchDay);
            return;
        }

        Optional<DailyGage> opt = dailyGageRepository.findByMatchDate(matchDay);
        if (opt.isEmpty()) {
            log.debug("No daily gage configured for {}", matchDay);
            return;
        }
        DailyGage dg = opt.get();
        if (dg.getStatus() == DailyGage.Status.SETTLED) return;

        // Determine the forfeit to assign
        Forfeit forfeit = dg.getForfeit();
        if (forfeit == null) {
            if (dg.getMode() == DailyGage.Mode.VOTE) {
                forfeit = selectWinnerByVotes(dg);
                if (forfeit == null) {
                    log.warn("⚠️ VOTE mode daily gage for {} has no candidates — skipping", matchDay);
                    return;
                }
                dg.setForfeit(forfeit);
            } else {
                log.warn("⚠️ DIRECT mode daily gage for {} has no forfeit selected — skipping", matchDay);
                return;
            }
        }

        // Compute per-player daily points from settled participations
        List<BetParticipation> participations =
                betParticipationRepository.findSettledByMatchDay(startOfDay, endOfDay);

        if (participations.isEmpty()) {
            log.warn("⚠️ No settled participations on {} — cannot assign daily gage", matchDay);
            return;
        }

        Map<User, Integer> dailyPoints = participations.stream()
                .collect(Collectors.groupingBy(
                        BetParticipation::getUser,
                        Collectors.summingInt(BetParticipation::getPointsEarned)));

        int minPoints = Collections.min(dailyPoints.values());
        List<User> losers = dailyPoints.entrySet().stream()
                .filter(e -> e.getValue() == minPoints)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        User unlucky = losers.get(new Random().nextInt(losers.size()));

        // Find an admin to record as assignedBy
        User admin = userRepository.findAll().stream()
                .filter(u -> u.getRole() == User.Role.ADMIN)
                .findFirst()
                .orElse(unlucky);

        UserForfeit uf = UserForfeit.builder()
                .user(unlucky)
                .forfeit(forfeit)
                .assignedBy(admin)
                .completed(false)
                .build();
        userForfeitRepository.save(uf);

        unlucky.setForfeitsReceived(unlucky.getForfeitsReceived() + 1);
        userRepository.save(unlucky);

        dg.setForfeit(forfeit);
        dg.setAssignedTo(unlucky);
        dg.setAssignedAt(LocalDateTime.now());
        dg.setStatus(DailyGage.Status.SETTLED);
        dailyGageRepository.save(dg);

        log.info("🃏 Daily gage '{}' assigned to {} for {} ({} pts earned, {} loser(s) in draw)",
                forfeit.getTitle(), unlucky.getUsername(), matchDay, minPoints, losers.size());
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private Forfeit selectWinnerByVotes(DailyGage dg) {
        return dg.getCandidates().stream()
                .max(Comparator.comparingInt(DailyGageCandidate::getVoteScore))
                .map(DailyGageCandidate::getForfeit)
                .orElse(null);
    }

    private DailyGage requireDailyGage(Long id) {
        return dailyGageRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("DailyGage not found: " + id));
    }

    private Forfeit requireForfeit(Long id) {
        return forfeitRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Forfeit not found: " + id));
    }

    private String currentUsername() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    // ---------------------------------------------------------------
    // Mapping
    // ---------------------------------------------------------------

    private DailyGageResponse toResponse(DailyGage dg, String currentUsername) {
        User currentUser = userRepository.findByUsername(currentUsername).orElse(null);
        Long currentUserId = currentUser != null ? currentUser.getId() : null;

        List<DailyGageCandidateResponse> candidateResponses = dg.getCandidates().stream()
                .map(c -> {
                    int userVote = 0;
                    if (currentUserId != null) {
                        Optional<DailyGageVote> v = c.getVotes().stream()
                                .filter(vote -> vote.getUser().getId().equals(currentUserId))
                                .findFirst();
                        userVote = v.map(DailyGageVote::getVote).orElse(0);
                    }
                    return DailyGageCandidateResponse.builder()
                            .id(c.getId())
                            .forfeit(toForfeitResponse(c.getForfeit()))
                            .voteScore(c.getVoteScore())
                            .userVote(userVote)
                            .build();
                })
                .toList();

        return DailyGageResponse.builder()
                .id(dg.getId())
                .matchDate(dg.getMatchDate())
                .forfeit(dg.getForfeit() != null ? toForfeitResponse(dg.getForfeit()) : null)
                .mode(dg.getMode().name())
                .status(dg.getStatus().name())
                .assignedToUsername(dg.getAssignedTo() != null ? dg.getAssignedTo().getUsername() : null)
                .assignedAt(dg.getAssignedAt())
                .candidates(candidateResponses)
                .createdAt(dg.getCreatedAt())
                .build();
    }

    private ForfeitResponse toForfeitResponse(Forfeit f) {
        return ForfeitResponse.builder()
                .id(f.getId())
                .title(f.getTitle())
                .description(f.getDescription())
                .category(f.getCategory())
                .isActive(f.isActive())
                .timesCompleted(f.getTimesCompleted())
                .proposedByUsername(f.getProposedBy() != null ? f.getProposedBy().getUsername() : null)
                .build();
    }
}
