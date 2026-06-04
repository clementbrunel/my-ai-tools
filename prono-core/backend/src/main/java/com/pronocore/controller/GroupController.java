package com.pronocore.controller;

import com.pronocore.dto.request.CreateGroupRequest;
import com.pronocore.dto.request.JoinGroupRequest;
import com.pronocore.dto.response.GroupMemberResponse;
import com.pronocore.dto.response.GroupResponse;
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
    @Operation(summary = "Join a group via invite code")
    public ResponseEntity<GroupResponse> joinGroup(@Valid @RequestBody JoinGroupRequest request,
                                                    Authentication auth) {
        return ResponseEntity.ok(groupService.joinGroup(request, auth.getName()));
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
}
