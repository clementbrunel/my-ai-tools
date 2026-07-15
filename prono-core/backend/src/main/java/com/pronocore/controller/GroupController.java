package com.pronocore.controller;

import com.pronocore.dto.request.UpdateGroupSportsRequest;
import com.pronocore.dto.request.CreateGroupRequest;
import com.pronocore.dto.request.JoinGroupRequest;
import com.pronocore.dto.request.NotifyNewMatchesRequest;
import com.pronocore.dto.request.NotifyNewRacesRequest;
import com.pronocore.dto.request.UpdateGroupPrivacyRequest;
import com.pronocore.dto.response.GroupMemberResponse;
import com.pronocore.dto.response.GroupResponse;
import com.pronocore.dto.response.MatchResponse;
import com.pronocore.dto.response.PublicGroupResponse;
import com.pronocore.dto.response.RaceResponse;
import com.pronocore.service.GroupService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
@Tag(name = "Groups", description = "Play group management")
public class GroupController {

    private final GroupService groupService;

    @GetMapping
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    @Operation(summary = "List all groups (Platform admin only)")
    public ResponseEntity<List<GroupResponse>> getAllGroups() {
        return ResponseEntity.ok(groupService.getAllGroups());
    }

    @GetMapping("/public")
    @Operation(summary = "List all public groups with current user's membership status")
    public ResponseEntity<List<PublicGroupResponse>> getPublicGroups(Authentication auth) {
        return ResponseEntity.ok(groupService.getPublicGroups(auth.getName()));
    }

    @GetMapping("/mine")
    @Operation(summary = "List groups the authenticated user belongs to")
    public ResponseEntity<List<GroupResponse>> getMyGroups(Authentication auth) {
        return ResponseEntity.ok(groupService.getMyGroups(auth.getName()));
    }

    @GetMapping("/{groupId}")
    @Operation(summary = "Get group details")
    public ResponseEntity<GroupResponse> getGroup(@PathVariable Long groupId, Authentication auth) {
        return ResponseEntity.ok(groupService.getGroup(groupId, auth.getName()));
    }

    @PostMapping
    @Operation(summary = "Create a new group")
    public ResponseEntity<GroupResponse> createGroup(@Valid @RequestBody CreateGroupRequest request,
                                                      Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(groupService.createGroup(request, auth.getName()));
    }

    @PostMapping("/join")
    @Operation(summary = "Join a group via invite code (bypasses approval)")
    public ResponseEntity<GroupResponse> joinGroup(@Valid @RequestBody JoinGroupRequest request,
                                                    Authentication auth) {
        return ResponseEntity.ok(groupService.joinGroup(request, auth.getName()));
    }

    @PostMapping("/{groupId}/apply")
    @Operation(summary = "Apply to join a public group (requires admin approval)")
    public ResponseEntity<PublicGroupResponse> applyToGroup(@PathVariable Long groupId, Authentication auth) {
        return ResponseEntity.ok(groupService.applyToGroup(groupId, auth.getName()));
    }

    @PostMapping("/{groupId}/applications/{userId}/approve")
    @Operation(summary = "Approve a membership application (Group admin only)")
    public ResponseEntity<GroupMemberResponse> approveApplication(@PathVariable Long groupId,
                                                                   @PathVariable Long userId,
                                                                   Authentication auth) {
        return ResponseEntity.ok(groupService.approveApplication(groupId, userId, auth.getName()));
    }

    @DeleteMapping("/{groupId}/applications/{userId}/reject")
    @Operation(summary = "Reject a membership application (Group admin only)")
    public ResponseEntity<Void> rejectApplication(@PathVariable Long groupId,
                                                   @PathVariable Long userId,
                                                   Authentication auth) {
        groupService.rejectApplication(groupId, userId, auth.getName());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{groupId}/privacy")
    @Operation(summary = "Update group privacy (Group admin only)")
    public ResponseEntity<GroupResponse> updatePrivacy(@PathVariable Long groupId,
                                                        @RequestBody UpdateGroupPrivacyRequest request,
                                                        Authentication auth) {
        return ResponseEntity.ok(groupService.updatePrivacy(groupId, request.isPrivate(), auth.getName()));
    }

    @PatchMapping("/{groupId}/sports")
    @Operation(summary = "Update the sports a group plays (Group admin only)")
    public ResponseEntity<GroupResponse> updateSports(@PathVariable Long groupId,
                                                      @Valid @RequestBody UpdateGroupSportsRequest request,
                                                      Authentication auth) {
        return ResponseEntity.ok(groupService.updateSports(groupId, request.getSports(), auth.getName()));
    }

    @DeleteMapping("/{groupId}/leave")
    @Operation(summary = "Leave a group")
    public ResponseEntity<Void> leaveGroup(@PathVariable Long groupId, Authentication auth) {
        groupService.leaveGroup(groupId, auth.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{groupId}/members/{userId}/promote")
    @Operation(summary = "Promote a member to group admin (Group admin only)")
    public ResponseEntity<GroupMemberResponse> promoteMember(@PathVariable Long groupId,
                                                              @PathVariable Long userId,
                                                              Authentication auth) {
        return ResponseEntity.ok(groupService.promoteMember(groupId, userId, auth.getName()));
    }

    @PostMapping("/{groupId}/members/{userId}/demote")
    @Operation(summary = "Demote a group admin to member (Group admin only)")
    public ResponseEntity<GroupMemberResponse> demoteMember(@PathVariable Long groupId,
                                                             @PathVariable Long userId,
                                                             Authentication auth) {
        return ResponseEntity.ok(groupService.demoteMember(groupId, userId, auth.getName()));
    }

    @DeleteMapping("/{groupId}/members/{userId}")
    @Operation(summary = "Remove a member from the group (Group admin only)")
    public ResponseEntity<Void> removeMember(@PathVariable Long groupId,
                                              @PathVariable Long userId,
                                              Authentication auth) {
        groupService.removeMember(groupId, userId, auth.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{groupId}/future-open-matches")
    @Operation(summary = "List future matches open for pronostics in this group (Group admin only)")
    public ResponseEntity<List<MatchResponse>> getFutureOpenMatches(@PathVariable Long groupId, Authentication auth) {
        return ResponseEntity.ok(groupService.getFutureOpenMatches(groupId, auth.getName()));
    }

    @PostMapping("/{groupId}/notify-new-matches")
    @Operation(summary = "Notify active group members by email about newly opened future matches (Group admin only)")
    public ResponseEntity<Void> notifyNewMatches(@PathVariable Long groupId,
                                                  @Valid @RequestBody NotifyNewMatchesRequest request,
                                                  Authentication auth) {
        groupService.notifyNewMatches(groupId, request.getMatchIds(), auth.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{groupId}/future-open-races")
    @Operation(summary = "List future F1 races open for pronostics in this group (Group admin only)")
    public ResponseEntity<List<RaceResponse>> getFutureOpenRaces(@PathVariable Long groupId, Authentication auth) {
        return ResponseEntity.ok(groupService.getFutureOpenRaces(groupId, auth.getName()));
    }

    @PostMapping("/{groupId}/notify-new-races")
    @Operation(summary = "Notify active group members by email about newly opened future F1 races (Group admin only)")
    public ResponseEntity<Void> notifyNewRaces(@PathVariable Long groupId,
                                                @Valid @RequestBody NotifyNewRacesRequest request,
                                                Authentication auth) {
        groupService.notifyNewRaces(groupId, request.getRaceIds(), auth.getName());
        return ResponseEntity.noContent().build();
    }
}
